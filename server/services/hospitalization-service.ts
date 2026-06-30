import {
  accrueDailyChargeTx,
  assignWardTx,
  authorizeDischargeTx,
  cancelAdmissionTx,
  countOutstandingEmergencyDebt,
  createAdmissionTx,
  findActiveAdmissionForEncounter,
  findActiveInpatientWardServiceById,
  findAdmissionById,
  findEncounterById,
  findLatestAdmissionForEncounter,
  findTariffByCode,
  listAdmissions,
  listOpenInvoicesForEncounter,
  requestDischargeTx,
  type HospitalContext,
} from "@/server/db";
import {
  computeDischargeBlock,
  dailyChargeDate,
  dailyChargeDateKey,
  validateAdmissionRequest,
  validateDailyWardFee,
} from "@/lib/hospitalization";
import { formatFcfa } from "@/lib/money";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Ward-level hospitalization service (Phase 2G). A doctor REQUESTS admission on an open encounter; the
 * admission desk / head nurse ASSIGNS a ward (an active INPATIENT_WARD service), which snapshots the
 * ward's configured daily Tariff as the deterministic daily fee; daily fees accrue onto a single
 * hospitalization invoice; the doctor REQUESTS then AUTHORISES discharge — the latter is BLOCKED while
 * the encounter has unpaid invoices or outstanding emergency debt (2H). Hospital-scoped; every act
 * audited. No bed/room-level tracking.
 */

export async function requestAdmission(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
  input: { reason: string },
) {
  await requireCapability(actor, ctx, "admission.request", { type: "Encounter", id: encounterId });
  const check = validateAdmissionRequest(input);
  if (!check.ok) throw new Error(check.error);

  const encounter = await findEncounterById(ctx.hospitalId, encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  if (encounter.status !== "open") {
    throw new Error("La visite doit être ouverte pour demander une hospitalisation.");
  }
  const active = await findActiveAdmissionForEncounter(ctx.hospitalId, encounterId);
  if (active) throw new Error("Une hospitalisation est déjà en cours pour cette visite.");

  const admissionNumber = await generateNumber(ctx, "admission", new Date().getFullYear());
  // createAdmissionTx re-checks the "one active admission per encounter" invariant UNDER an encounter
  // row lock, so two concurrent requests can't both create an admission (the pre-check above is a fast
  // UX fail; this is the authoritative guard).
  const admission = await createAdmissionTx({
    hospitalId: ctx.hospitalId,
    encounterId,
    patientId: encounter.patientId,
    admissionNumber,
    reason: input.reason.trim(),
    requestedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.admissionRequested,
    entityType: "Admission",
    entityId: admission.id,
    summary: `Hospitalisation ${admission.admissionNumber} demandée — visite ${encounter.encounterNumber}`,
  });
  return admission;
}

export async function assignWard(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  admissionId: string,
  input: { wardServiceUnitId: string },
) {
  await requireCapability(actor, ctx, "admission.assign", { type: "Admission", id: admissionId });
  const admission = await findAdmissionById(ctx.hospitalId, admissionId);
  if (!admission) throw new Error("Hospitalisation introuvable dans cet hôpital.");
  if (admission.status !== "requested") {
    throw new Error("Seule une demande d'hospitalisation peut recevoir un service.");
  }

  // Server-side enforcement: only an active INPATIENT_WARD service in THIS hospital can be a ward.
  const ward = await findActiveInpatientWardServiceById(ctx.hospitalId, input.wardServiceUnitId);
  if (!ward) throw new Error("Service d'hospitalisation invalide.");

  // The daily ward fee is configured via the ward's Tariff (code = the ward service code) and SNAPSHOT
  // here — deterministic + auditable. No active tariff ⇒ assignment is refused (must be configured).
  const tariff = await findTariffByCode(ctx.hospitalId, ward.code);
  if (!tariff || !tariff.isActive) {
    throw new Error(
      `Aucun tarif journalier actif n'est configuré pour ce service d'hospitalisation (code ${ward.code}).`,
    );
  }
  const feeCheck = validateDailyWardFee(tariff.amount);
  if (!feeCheck.ok) throw new Error(feeCheck.error);

  const updated = await assignWardTx({
    hospitalId: ctx.hospitalId,
    id: admissionId,
    wardServiceUnitId: ward.id,
    dailyWardFee: tariff.amount,
    dailyFeeTariffId: tariff.id,
    admittedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.admissionWardAssigned,
    entityType: "Admission",
    entityId: admissionId,
    summary: `Hospitalisation ${admission.admissionNumber} — service ${ward.nameFr ?? ward.name ?? ward.code}, tarif journalier ${formatFcfa(tariff.amount)}`,
  });
  return updated;
}

export async function cancelAdmission(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  admissionId: string,
  reason: string,
) {
  await requireCapability(actor, ctx, "admission.request", { type: "Admission", id: admissionId });
  if (!reason?.trim()) throw new Error("Le motif d'annulation est obligatoire.");
  const admission = await findAdmissionById(ctx.hospitalId, admissionId);
  if (!admission) throw new Error("Hospitalisation introuvable dans cet hôpital.");

  const updated = await cancelAdmissionTx({
    hospitalId: ctx.hospitalId,
    id: admissionId,
    cancelledById: actor.id,
    cancelReason: reason.trim(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.admissionCancelled,
    entityType: "Admission",
    entityId: admissionId,
    summary: `Hospitalisation ${admission.admissionNumber} annulée — motif : ${reason.trim()}`,
  });
  return updated;
}

export async function requestDischarge(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  admissionId: string,
) {
  await requireCapability(actor, ctx, "admission.discharge", { type: "Admission", id: admissionId });
  const admission = await findAdmissionById(ctx.hospitalId, admissionId);
  if (!admission) throw new Error("Hospitalisation introuvable dans cet hôpital.");

  const updated = await requestDischargeTx({ hospitalId: ctx.hospitalId, id: admissionId });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.admissionDischargeRequested,
    entityType: "Admission",
    entityId: admissionId,
    summary: `Hospitalisation ${admission.admissionNumber} — sortie demandée`,
  });
  return updated;
}

export async function authorizeDischarge(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  admissionId: string,
) {
  await requireCapability(actor, ctx, "admission.discharge", { type: "Admission", id: admissionId });
  const admission = await findAdmissionById(ctx.hospitalId, admissionId);
  if (!admission) throw new Error("Hospitalisation introuvable dans cet hôpital.");
  if (admission.status !== "admitted" && admission.status !== "discharge_requested") {
    throw new Error("Cette hospitalisation ne peut pas être clôturée dans son état actuel.");
  }

  // The discharge gate (unpaid invoices OR outstanding emergency debt) is enforced ATOMICALLY inside
  // authorizeDischargeTx — it locks the encounter row, re-reads the gate, and transitions in one
  // transaction, so a concurrent payment/emergency-accrual cannot make the decision stale.
  const updated = await authorizeDischargeTx({
    hospitalId: ctx.hospitalId,
    id: admissionId,
    encounterId: admission.encounterId,
    dischargedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.admissionDischarged,
    entityType: "Admission",
    entityId: admissionId,
    summary: `Hospitalisation ${admission.admissionNumber} — sortie autorisée`,
  });
  return updated;
}

export async function generateDailyWardCharge(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  admissionId: string,
  forDate?: Date,
) {
  await requireCapability(actor, ctx, "admission.fee.charge", { type: "Admission", id: admissionId });
  const admission = await findAdmissionById(ctx.hospitalId, admissionId);
  if (!admission) throw new Error("Hospitalisation introuvable dans cet hôpital.");
  if (admission.status !== "admitted") {
    throw new Error("Les frais journaliers ne s'appliquent qu'à une hospitalisation en cours.");
  }

  const day = dailyChargeDate(forDate ?? new Date());
  const wardName = admission.wardService?.nameFr ?? admission.wardService?.name ?? "Hospitalisation";
  const label = `Frais journaliers d'hospitalisation — ${wardName} (${dailyChargeDateKey(day)})`;
  // Generate the hospitalization invoice number only when one does not exist yet (lazy creation).
  const newInvoiceNumber = admission.invoiceId
    ? null
    : await generateNumber(ctx, "invoice", new Date().getFullYear());

  const result = await accrueDailyChargeTx({
    hospitalId: ctx.hospitalId,
    admissionId,
    chargeDate: day,
    label,
    newInvoiceNumber,
    createdById: actor.id,
  });
  if (result.created) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.admissionDailyFeeCharged,
      entityType: "Admission",
      entityId: admissionId,
      summary: `Hospitalisation ${admission.admissionNumber} — frais journaliers ${formatFcfa(result.amount)} (${dailyChargeDateKey(day)})`,
    });
  }
  return result;
}

/** Compute the discharge gate for an encounter (unpaid invoices + outstanding emergency debt). */
async function computeEncounterDischargeBlock(ctx: HospitalContext, encounterId: string) {
  const [openInvoices, outstandingEmergencyDebt] = await Promise.all([
    listOpenInvoicesForEncounter(ctx.hospitalId, encounterId),
    countOutstandingEmergencyDebt(ctx.hospitalId, encounterId),
  ]);
  return computeDischargeBlock({
    unpaidInvoiceCount: openInvoices.length,
    outstandingEmergencyDebt,
  });
}

/** The current/most-recent admission on an encounter + the live discharge gate, for the encounter UI. */
export async function getAdmissionForEncounter(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
) {
  await requireCapability(actor, ctx, "admission.read");
  const admission = await findLatestAdmissionForEncounter(ctx.hospitalId, encounterId);
  if (!admission) return { admission: null, dischargeBlock: { blocked: false, reasons: [] as string[] } };
  const dischargeBlock =
    admission.status === "admitted" || admission.status === "discharge_requested"
      ? await computeEncounterDischargeBlock(ctx, encounterId)
      : { blocked: false, reasons: [] as string[] };
  return { admission, dischargeBlock };
}

export async function listHospitalAdmissions(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts?: { statuses?: ("requested" | "admitted" | "discharge_requested" | "discharged" | "cancelled")[] },
) {
  await requireCapability(actor, ctx, "admission.read");
  return listAdmissions(ctx.hospitalId, opts);
}
