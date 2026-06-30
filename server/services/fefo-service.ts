import {
  findPrescriptionById,
  findReservationById,
  findStockBatchById,
  listReservationsForPrescription,
  listStockForMedication,
  overrideReservationBatch as overrideReservationBatchDb,
  type HospitalContext,
} from "@/server/db";
import { availableToReserve, fefoBatchId, isExpired, validateFefoOverride } from "@/lib/stock";
import { formatDateFr } from "@/lib/dates";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * FEFO service (Phase 2D-6). FEFO (first-expiry-first-out) is ALREADY the default: reservations are
 * allocated earliest-expiry-first (2D-4) and dispensing consumes them (2D-5). This service adds the
 * ONLY sanctioned deviation — the **Pharmacist-in-Charge** (`pharmacien_chef`) re-points an active
 * reservation off its FEFO batch onto a deliberately chosen, NON-expired batch, with a mandatory
 * reason, recorded durably on the reservation and audited as `fefo.override`. A regular pharmacist
 * cannot override; expired-stock handling is the separate dual-validated flow (2D-7).
 */

/**
 * Active reservations for a prescription, each with its current batch, whether it is the FEFO choice,
 * and the alternative batches the Pharmacist-in-Charge could override to. Read for pharmacy/oversight.
 */
export async function getReservationOverrideOptions(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  await requireCapability(actor, ctx, "dispense.read");
  const reservations = await listReservationsForPrescription(ctx.hospitalId, prescriptionId, "active");
  const now = new Date();

  const batchesByMed = new Map<string, Awaited<ReturnType<typeof listStockForMedication>>>();
  const out = [];
  for (const r of reservations) {
    let batches = batchesByMed.get(r.medicationId);
    if (!batches) {
      batches = await listStockForMedication(ctx.hospitalId, r.medicationId);
      batchesByMed.set(r.medicationId, batches);
    }
    const fefoId = fefoBatchId(batches, r.quantity, now);
    const candidates = batches
      .filter(
        (b) =>
          b.id !== r.batchId &&
          !isExpired(b.expiryDate, now) &&
          availableToReserve(b) >= r.quantity,
      )
      .map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        available: availableToReserve(b),
      }));
    out.push({
      id: r.id,
      quantity: r.quantity,
      isFefoOverride: r.isFefoOverride,
      overrideReason: r.overrideReason,
      medicationLabel: r.prescriptionItem.medicationLabel,
      unit: r.prescriptionItem.unit,
      batch: { id: r.batch.id, batchNumber: r.batch.batchNumber, expiryDate: r.batch.expiryDate },
      isCurrentFefo: fefoId === r.batchId,
      candidates,
    });
  }
  return out;
}

/**
 * Pharmacist-in-Charge re-points an active reservation onto a chosen (non-FEFO) batch with a reason.
 * Validates the target (same medication, not expired, enough available) and records `fefo.override`.
 */
export async function overrideReservationBatch(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { prescriptionId: string; reservationId: string; toBatchId: string; reason: string },
) {
  await requireCapability(actor, ctx, "fefo.override", {
    type: "Prescription",
    id: input.prescriptionId,
  });

  // The override is scoped to the prescription being viewed: the prescription must exist (and not be
  // soft-deleted) and the reservation must belong to it — a tampered reservationId from another
  // prescription is rejected (defence-in-depth, matching dispensePrescription / confirmPrescriptionPayment).
  const presc = await findPrescriptionById(ctx.hospitalId, input.prescriptionId);
  if (!presc) throw new Error("Ordonnance introuvable dans cet hôpital.");
  const reservation = await findReservationById(ctx.hospitalId, input.reservationId);
  if (!reservation || reservation.prescriptionId !== input.prescriptionId) {
    throw new Error("Réservation introuvable pour cette ordonnance.");
  }
  if (reservation.status !== "active") {
    throw new Error("Seule une réservation active peut faire l'objet d'une dérogation FEFO.");
  }
  const target = await findStockBatchById(ctx.hospitalId, input.toBatchId);
  if (!target) throw new Error("Lot choisi introuvable dans cet hôpital.");

  const now = new Date();
  const check = validateFefoOverride({
    currentBatchId: reservation.batchId,
    reason: input.reason,
    quantity: reservation.quantity,
    target: {
      id: target.id,
      medicationId: target.medicationId,
      expiryDate: target.expiryDate,
      quantityOnHand: target.quantityOnHand,
      quantityReserved: target.quantityReserved,
    },
    medicationId: reservation.medicationId,
    now,
  });
  if (!check.ok) throw new Error(check.error);

  // The FEFO batch this override deviates from (for the audit record).
  const batches = await listStockForMedication(ctx.hospitalId, reservation.medicationId);
  const fefoId = fefoBatchId(batches, reservation.quantity, now);
  const fefoBatch = batches.find((b) => b.id === fefoId);

  const updated = await overrideReservationBatchDb({
    hospitalId: ctx.hospitalId,
    reservationId: reservation.id,
    fromBatchId: reservation.batchId,
    toBatchId: target.id,
    quantity: reservation.quantity,
    targetReservedSeen: target.quantityReserved,
    overrideById: actor.id,
    reason: input.reason.trim(),
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.fefoOverride,
    entityType: "StockReservation",
    entityId: reservation.id,
    summary:
      `Dérogation FEFO — ${reservation.prescriptionItem.medicationLabel} : lot ${reservation.batch.batchNumber} ` +
      `(prio. ${fefoBatch ? fefoBatch.batchNumber : "—"}, exp. ${formatDateFr(new Date(reservation.batch.expiryDate))}) → ` +
      `lot ${target.batchNumber} (exp. ${formatDateFr(new Date(target.expiryDate))}), ` +
      `${reservation.quantity} unité(s) — motif : ${input.reason.trim()}`,
  });

  return updated;
}
