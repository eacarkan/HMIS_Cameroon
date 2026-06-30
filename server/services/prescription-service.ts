import {
  canTransitionPrescription,
  validatePrescriptionItem,
  type PrescriptionItemInput,
} from "@/lib/prescription";
import {
  createPrescriptionWithItems,
  findEncounterById,
  findMedicationById,
  findPrescriptionById,
  listPrescriptions as dbList,
  listPrescriptionsForEncounter as dbListForEncounter,
  updatePrescriptionStatus,
  type HospitalContext,
} from "@/server/db";
import type { PrescriptionStatus } from "@prisma/client";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";
import {
  releaseReservationsForPrescription,
  reserveForPrescription,
} from "./reservation-service";

/**
 * Prescription service (Phase 2D-2). A doctor creates a structured prescription during an encounter,
 * finalizes it, and sends it to the pharmacy. Items SNAPSHOT the medication label + unit at prescribe
 * time. A prescription has NO stock effect here (reservation = 2D-4, dispensing = 2D-5). Hospital
 * scoped; audited; state machine from `lib/prescription`.
 */

export type CreatePrescriptionInput = {
  encounterId: string;
  notes?: string | null;
  items: PrescriptionItemInput[];
};

export async function getPrescription(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "prescription.read");
  return findPrescriptionById(ctx.hospitalId, id);
}

export async function listPrescriptionsForEncounter(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
) {
  await requireCapability(actor, ctx, "prescription.read");
  return dbListForEncounter(ctx.hospitalId, encounterId);
}

export async function listPrescriptions(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  status?: PrescriptionStatus,
) {
  await requireCapability(actor, ctx, "prescription.read");
  return dbList(ctx.hospitalId, status);
}

export async function createPrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: CreatePrescriptionInput,
) {
  await requireCapability(actor, ctx, "prescription.create");
  const encounter = await findEncounterById(ctx.hospitalId, input.encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  if (!input.items || input.items.length === 0) {
    throw new Error("Ajoutez au moins un médicament à l'ordonnance.");
  }

  const itemRows = [];
  for (const it of input.items) {
    const check = validatePrescriptionItem(it);
    if (!check.ok) throw new Error(check.error);
    const med = await findMedicationById(ctx.hospitalId, it.medicationId);
    if (!med || !med.isActive) {
      throw new Error("Médicament introuvable ou inactif dans cet hôpital.");
    }
    itemRows.push({
      medicationId: med.id,
      medicationLabel: med.strength ? `${med.nameFr} ${med.strength}` : med.nameFr,
      unit: med.unit,
      dosage: it.dosage.trim(),
      frequency: it.frequency?.trim() || null,
      duration: it.duration.trim(),
      quantity: it.quantity,
      instructions: it.instructions?.trim() || null,
    });
  }

  const year = new Date().getFullYear();
  const prescriptionNumber = await generateNumber(ctx, "prescription", year);
  const prescription = await createPrescriptionWithItems({
    hospitalId: ctx.hospitalId,
    prescriptionNumber,
    patientId: encounter.patientId,
    encounterId: encounter.id,
    prescribedById: actor.id,
    notes: input.notes?.trim() || null,
    createdById: actor.id,
    items: itemRows,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.prescriptionCreated,
    entityType: "Prescription",
    entityId: prescription.id,
    summary: `Création de l'ordonnance ${prescription.prescriptionNumber} (${itemRows.length} ligne(s))`,
  });
  return prescription;
}

async function transition(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  to: PrescriptionStatus,
  action: string,
  summaryVerb: string,
  stamps: Partial<{ finalizedAt: Date; sentAt: Date; cancelledAt: Date }>,
) {
  await requireCapability(actor, ctx, "prescription.create", { type: "Prescription", id });
  const presc = await findPrescriptionById(ctx.hospitalId, id);
  if (!presc) throw new Error("Ordonnance introuvable dans cet hôpital.");
  if (!canTransitionPrescription(presc.status, to)) {
    throw new Error(`Transition d'ordonnance invalide : ${presc.status} → ${to}.`);
  }
  await updatePrescriptionStatus(ctx.hospitalId, id, to, stamps);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action,
    entityType: "Prescription",
    entityId: id,
    summary: `${summaryVerb} ${presc.prescriptionNumber}`,
  });
  return findPrescriptionById(ctx.hospitalId, id);
}

export function finalizePrescription(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  return transition(
    actor,
    ctx,
    id,
    "finalized",
    AUDIT_ACTIONS.prescriptionFinalized,
    "Finalisation de l'ordonnance",
    { finalizedAt: new Date() },
  );
}

/** Send to pharmacy + RESERVE stock (FEFO, no deduction) as a side-effect (Phase 2D-4). */
export async function sendPrescriptionToPharmacy(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await transition(
    actor,
    ctx,
    id,
    "sent_to_pharmacy",
    AUDIT_ACTIONS.prescriptionSentToPharmacy,
    "Envoi à la pharmacie de l'ordonnance",
    { sentAt: new Date() },
  );
  await reserveForPrescription(actor, ctx, id);
  return findPrescriptionById(ctx.hospitalId, id);
}

/** Cancel + RELEASE any active stock reservations back to the shelf (Phase 2D-4). */
export async function cancelPrescription(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  const result = await transition(
    actor,
    ctx,
    id,
    "cancelled",
    AUDIT_ACTIONS.prescriptionCancelled,
    "Annulation de l'ordonnance",
    { cancelledAt: new Date() },
  );
  await releaseReservationsForPrescription(actor, ctx, id);
  return result;
}
