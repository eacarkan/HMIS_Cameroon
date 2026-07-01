import { allocateFefo, availableToReserve, isExpired } from "@/lib/stock";
import {
  createReservation,
  findActiveReservationsOlderThan,
  findPrescriptionById,
  incrementStockBatch,
  listReservationsForPrescription,
  listStockForMedication,
  setReservationStatus,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Stock reservation service (Phase 2D-4). When a prescription is sent to the pharmacy, stock is
 * RESERVED (FEFO, earliest expiry first) — `quantityReserved` rises but `quantityOnHand` is NOT
 * deducted (deduction happens on Dispense, 2D-5). Reservations are released on prescription
 * cancellation and by the 48h non-collection sweep. Integer quantities; hospital-scoped; audited.
 */

const RESERVATION_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * INTERNAL — reserve stock for a sent prescription. Called by `sendPrescriptionToPharmacy` as a
 * side-effect of the (already-authorized) send; no separate capability check. Reserves up to the
 * available-to-reserve across FEFO batches; any shortfall is reported (dispensing handles partial).
 */
export async function reserveForPrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  const presc = await findPrescriptionById(ctx.hospitalId, prescriptionId);
  if (!presc) return { totalReserved: 0, totalShortfall: 0 };

  let totalReserved = 0;
  let totalShortfall = 0;
  const now = new Date();
  for (const item of presc.items) {
    const batches = await listStockForMedication(ctx.hospitalId, item.medicationId);
    // Pharmaceutical safety: NEVER reserve from an expired lot. FEFO allocates earliest-expiry first,
    // so without this filter an already-expired batch would be reserved (and later dispensed) ahead of
    // valid stock. Expired lots are removed via a stock adjustment (2D-7), not dispensed.
    const usable = batches.filter((b) => !isExpired(b.expiryDate, now));
    const { allocations, shortfall } = allocateFefo(usable, item.quantity, availableToReserve);
    for (const a of allocations) {
      await createReservation({
        hospitalId: ctx.hospitalId,
        prescriptionId,
        prescriptionItemId: item.id,
        medicationId: item.medicationId,
        batchId: a.batchId,
        quantity: a.quantity,
        createdById: actor.id,
      });
      await incrementStockBatch(ctx.hospitalId, a.batchId, { quantityReserved: a.quantity });
      totalReserved += a.quantity;
    }
    totalShortfall += shortfall;
  }

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.reservationCreated,
    entityType: "Prescription",
    entityId: prescriptionId,
    summary:
      `Réservation de stock pour l'ordonnance ${presc.prescriptionNumber} — ` +
      `${totalReserved} unité(s) réservée(s)` +
      (totalShortfall > 0 ? `, ${totalShortfall} en rupture` : ""),
  });
  return { totalReserved, totalShortfall };
}

/** INTERNAL — release all active reservations of a prescription (on cancellation). */
export async function releaseReservationsForPrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  const active = await listReservationsForPrescription(ctx.hospitalId, prescriptionId, "active");
  let released = 0;
  for (const r of active) {
    await incrementStockBatch(ctx.hospitalId, r.batchId, { quantityReserved: -r.quantity });
    await setReservationStatus(ctx.hospitalId, r.id, "released", { releasedAt: new Date() });
    released += r.quantity;
  }
  if (released > 0) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.reservationReleased,
      entityType: "Prescription",
      entityId: prescriptionId,
      summary: `Libération de ${released} unité(s) réservée(s) — annulation de l'ordonnance`,
    });
  }
  return released;
}

export async function listPrescriptionReservations(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  await requireCapability(actor, ctx, "prescription.read");
  return listReservationsForPrescription(ctx.hospitalId, prescriptionId);
}

/**
 * Manual 48h sweep — release active reservations older than 48h (paid-but-not-collected). Returns
 * the count + units released. Deterministic (the `now` is injectable for tests). Pharmacy/admin.
 */
export async function releaseStaleReservations(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  now: Date = new Date(),
) {
  await requireCapability(actor, ctx, "reservation.release");
  const cutoff = new Date(now.getTime() - RESERVATION_TTL_MS);
  const stale = await findActiveReservationsOlderThan(ctx.hospitalId, cutoff);
  let released = 0;
  for (const r of stale) {
    await incrementStockBatch(ctx.hospitalId, r.batchId, { quantityReserved: -r.quantity });
    await setReservationStatus(ctx.hospitalId, r.id, "released", { releasedAt: now });
    released += r.quantity;
  }
  if (stale.length > 0) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.reservationReleased,
      entityType: "MedicationStockBatch",
      entityId: null,
      summary: `Libération de ${stale.length} réservation(s) échue(s) (>48h) — ${released} unité(s) rendues au stock`,
    });
  }
  return { count: stale.length, released };
}
