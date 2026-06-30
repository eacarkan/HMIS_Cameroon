import {
  dispenseReservationsForPrescription,
  findDispenseRecordById,
  findEncounterById,
  findPrescriptionById,
  listDispenseRecordsForPrescription,
  listPharmacyWorklist,
  listReservationsForPrescription,
  setPrescriptionPaid,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Dispensing service (Phase 2D-5). The cashier confirms a prescription was paid (collection payment);
 * the pharmacy then dispenses — CONSUMING the FEFO reservations made at send time (2D-4): on-hand is
 * deducted, `quantityReserved` is released, and the reservation is marked `consumed`. Partial when
 * the reserved quantity is short of the requested. A printable dispense record is produced.
 * Integer quantities; hospital-scoped; audited. The "paid check" stands in for the (deferred 2H)
 * emergency exception.
 */

/** The pharmacy dispensing work queue is an OPERATIONAL pharmacy view — only dispensers may read it. */
export async function getPharmacyWorklist(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "dispense.perform");
  return listPharmacyWorklist(ctx.hospitalId);
}

/** Dispense records expose batch-level pharmacy decisions — gated on `dispense.read` (pharmacy + oversight). */
export async function getDispenseRecord(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "dispense.read");
  return findDispenseRecordById(ctx.hospitalId, id);
}

export async function listDispensesForPrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  await requireCapability(actor, ctx, "dispense.read");
  return listDispenseRecordsForPrescription(ctx.hospitalId, prescriptionId);
}

/** Cashier confirms the patient paid at the cashier (the dispensing precondition). Idempotent. */
export async function confirmPrescriptionPayment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  await requireCapability(actor, ctx, "prescription.payment.confirm", {
    type: "Prescription",
    id: prescriptionId,
  });
  const presc = await findPrescriptionById(ctx.hospitalId, prescriptionId);
  if (!presc) throw new Error("Ordonnance introuvable dans cet hôpital.");
  if (presc.status === "draft" || presc.status === "cancelled") {
    throw new Error("L'ordonnance doit être finalisée avant la confirmation de paiement.");
  }
  if (presc.isPaid) return presc; // idempotent
  await setPrescriptionPaid(ctx.hospitalId, prescriptionId, actor.id);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.prescriptionPaymentConfirmed,
    entityType: "Prescription",
    entityId: prescriptionId,
    summary: `Paiement confirmé pour l'ordonnance ${presc.prescriptionNumber}`,
  });
  return findPrescriptionById(ctx.hospitalId, prescriptionId);
}

/**
 * Dispense a prescription: requires it to be PAID and sent/partially-dispensed. Consumes the active
 * reservations per line (deduct on-hand + release reserved + mark consumed), writes a dispense record,
 * and advances the prescription to `dispensed` (all lines fully served) or `partially_dispensed`.
 */
export async function dispensePrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  prescriptionId: string,
) {
  await requireCapability(actor, ctx, "dispense.perform", { type: "Prescription", id: prescriptionId });
  const presc = await findPrescriptionById(ctx.hospitalId, prescriptionId);
  if (!presc) throw new Error("Ordonnance introuvable dans cet hôpital.");
  // Phase 2H — the cashier paid-check is bypassed for an EMERGENCY encounter ("treat first, pay later");
  // the charge is then carried as auditable Emergency Debt to be settled/waived before discharge.
  let emergencyBypass = false;
  if (!presc.isPaid) {
    const enc = await findEncounterById(ctx.hospitalId, presc.encounterId);
    if (!enc?.isEmergency) {
      throw new Error("L'ordonnance doit être payée à la caisse avant la délivrance.");
    }
    emergencyBypass = true;
  }
  if (presc.status !== "sent_to_pharmacy" && presc.status !== "partially_dispensed") {
    throw new Error("Cette ordonnance ne peut pas être délivrée dans son statut actuel.");
  }
  // Cheap pre-check so the common "nothing to dispense" case fails BEFORE a sequence number is spent.
  const active = await listReservationsForPrescription(ctx.hospitalId, prescriptionId, "active");
  if (active.length === 0) {
    throw new Error("Aucune réservation active à délivrer pour cette ordonnance.");
  }

  // The entire consume → deduct → record → status transition runs atomically (one $transaction in the
  // data layer) with a guarded reservation claim, so a concurrent double-dispense cannot deduct twice.
  // Phase 3 QA patch: for an emergency bypass the PLACEHOLDER Emergency Debt is now accrued INSIDE that
  // same transaction (commit-or-fail together) — the dispense fails if the debt cannot be created, and
  // the debt is idempotent per prescription (no duplicate on retry / partial re-dispense). Medications
  // carry no price in 2D, so the placeholder is amount 0 ("à tarifer"), priced/settled at the cashier
  // (or waived by the Director) before discharge.
  const year = new Date().getFullYear();
  const dispenseNumber = await generateNumber(ctx, "dispense", year);
  const { record, totalUnits, allFull, emergencyDebt } = await dispenseReservationsForPrescription({
    hospitalId: ctx.hospitalId,
    prescriptionId,
    dispensedById: actor.id,
    dispenseNumber,
    lines: presc.items.map((it) => ({
      prescriptionItemId: it.id,
      medicationLabel: it.medicationLabel,
      unit: it.unit,
      quantity: it.quantity,
    })),
    emergencyDebt: emergencyBypass
      ? {
          encounterId: presc.encounterId,
          patientId: presc.patientId,
          amount: 0,
          source: `Délivrance d'urgence (ordonnance ${presc.prescriptionNumber}) — montant à définir à la caisse`,
          createdById: actor.id,
        }
      : null,
  });
  if (!record) {
    // A concurrent dispense won every reservation between the pre-check and the transaction.
    throw new Error("Aucune réservation active à délivrer pour cette ordonnance.");
  }

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.dispenseCompleted,
    entityType: "DispenseRecord",
    entityId: record.id,
    summary:
      `Délivrance ${record.dispenseNumber} — ordonnance ${presc.prescriptionNumber}, ` +
      `${totalUnits} unité(s)` +
      (allFull ? "" : " (délivrance partielle)") +
      (emergencyBypass ? " (URGENCE — paiement différé)" : ""),
  });

  // The emergency-bypass debt was coupled inside the dispense transaction above (so the discharge gate
  // 2G can never miss it). Audit the accrual ONLY when a debt was newly created — a retry / partial
  // re-dispense reuses the existing placeholder (idempotent) and must not re-audit.
  if (emergencyDebt?.created) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.emergencyDebtAccrued,
      entityType: "EmergencyDebt",
      entityId: emergencyDebt.id,
      summary: `Dette d'urgence (à tarifer) ouverte automatiquement — délivrance ${record.dispenseNumber}`,
    });
  }
  return record;
}
