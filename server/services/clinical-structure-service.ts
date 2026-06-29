import {
  type HospitalContext,
  findConsultationById,
  listActiveDiagnosisCodes as dbListActiveDiagnosisCodes,
  listObservations as dbListObservations,
  createObservation as dbCreateObservation,
  findObservationById,
  updateObservation as dbUpdateObservation,
  listDiagnoses as dbListDiagnoses,
  createDiagnosis as dbCreateDiagnosis,
  findDiagnosisById,
  updateDiagnosis as dbUpdateDiagnosis,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Clinical structure service (Gate 3, 23 §5) — structured Observations (vitals) and
 * Diagnoses attached to a Consultation. Clinician-only (MED); ACC/CAI denied; admin not
 * routine. Hospital scoping is enforced THROUGH the consultation (must belong to the
 * active hospital). The free-text Consultation.vitals/.provisionalDiagnosis fields are
 * KEPT — this is additive structure, not a finalization workflow; no Practitioner.
 */

async function requireConsultationInHospital(ctx: HospitalContext, consultationId: string) {
  const consultation = await findConsultationById(ctx.hospitalId, consultationId);
  if (!consultation) throw new Error("Consultation introuvable dans cet hôpital.");
  return consultation;
}

// ---- Observations (vitals) ----
export async function listObservations(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  consultationId: string,
) {
  await requireCapability(actor, ctx, "clinical.structure.read");
  await requireConsultationInHospital(ctx, consultationId);
  return dbListObservations(ctx.hospitalId, consultationId);
}

export async function addObservation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  consultationId: string,
  input: { type: string; value: string; unit?: string | null },
) {
  await requireCapability(actor, ctx, "clinical.structure.manage", { type: "Observation" });
  await requireConsultationInHospital(ctx, consultationId);
  const observation = await dbCreateObservation({
    hospitalId: ctx.hospitalId,
    consultationId,
    type: input.type,
    value: input.value,
    unit: input.unit ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.observationCreate,
    entityType: "Observation",
    entityId: observation.id,
    summary: `Constante enregistrée (${input.type})`,
  });
  return observation;
}

export async function updateObservation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { type?: string; value?: string; unit?: string | null },
) {
  await requireCapability(actor, ctx, "clinical.structure.manage", { type: "Observation", id });
  const existing = await findObservationById(ctx.hospitalId, id);
  if (!existing) throw new Error("Constante introuvable dans cet hôpital.");
  const observation = await dbUpdateObservation(id, input);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.observationUpdate,
    entityType: "Observation",
    entityId: id,
    summary: "Mise à jour d'une constante",
  });
  return observation;
}

// ---- Diagnosis-code reference (Phase 2B — ICD-10 subset for the picker) ----
/** List the active ICD-10 diagnosis-code subset (global reference). Clinical read. */
export async function listDiagnosisCodes(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "clinical.structure.read");
  return dbListActiveDiagnosisCodes();
}

// ---- Diagnoses ----
export async function listDiagnoses(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  consultationId: string,
) {
  await requireCapability(actor, ctx, "clinical.structure.read");
  await requireConsultationInHospital(ctx, consultationId);
  return dbListDiagnoses(ctx.hospitalId, consultationId);
}

export async function addDiagnosis(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  consultationId: string,
  input: { label: string; code?: string | null; isPrimary?: boolean },
) {
  await requireCapability(actor, ctx, "clinical.structure.manage", { type: "Diagnosis" });
  await requireConsultationInHospital(ctx, consultationId);
  const diagnosis = await dbCreateDiagnosis({
    hospitalId: ctx.hospitalId,
    consultationId,
    label: input.label,
    code: input.code ?? null,
    isPrimary: input.isPrimary ?? false,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosisCreate,
    entityType: "Diagnosis",
    entityId: diagnosis.id,
    summary: `Diagnostic enregistré : ${input.label}`,
  });
  return diagnosis;
}

export async function updateDiagnosis(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { label?: string; code?: string | null; isPrimary?: boolean },
) {
  await requireCapability(actor, ctx, "clinical.structure.manage", { type: "Diagnosis", id });
  const existing = await findDiagnosisById(ctx.hospitalId, id);
  if (!existing) throw new Error("Diagnostic introuvable dans cet hôpital.");
  const diagnosis = await dbUpdateDiagnosis(id, input);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosisUpdate,
    entityType: "Diagnosis",
    entityId: id,
    summary: "Mise à jour d'un diagnostic",
  });
  return diagnosis;
}
