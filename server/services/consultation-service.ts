import {
  canAmend,
  canFinalize,
  type ConsultationStatus,
} from "@/lib/consultation-status";
import {
  createConsultation,
  findConsultationById,
  findConsultationDetail,
  findEncounterById,
  findEntityAuditTrail,
  updateConsultation,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/** Consultation service (09 §4) — reason + free-text fields + structured data (05 §4). */

export type RecordConsultationInput = {
  reason: string;
  clinicalNote: string | null;
  vitals: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
  /** When false, the note is saved as a draft (default true → finalized on save). */
  finalize?: boolean;
};

export type AmendConsultationInput = {
  clinicalNote: string | null;
  vitals: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
};

const HISTORY_ACTIONS = [
  AUDIT_ACTIONS.consultationCreate,
  AUDIT_ACTIONS.consultationFinalize,
  AUDIT_ACTIONS.consultationAmend,
];

export async function recordConsultation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
  input: RecordConsultationInput,
) {
  await requireCapability(actor, ctx, "consultation.create");

  const encounter = await findEncounterById(ctx.hospitalId, encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");

  const finalize = input.finalize !== false;
  const consultation = await createConsultation({
    hospitalId: ctx.hospitalId,
    encounterId,
    status: finalize ? "finalized" : "draft",
    reason: input.reason,
    clinicalNote: input.clinicalNote,
    vitals: input.vitals,
    provisionalDiagnosis: input.provisionalDiagnosis,
    recommendation: input.recommendation,
    performedById: actor.id,
    createdById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.consultationCreate,
    entityType: "Consultation",
    entityId: consultation.id,
    summary: finalize ? "Saisie et finalisation de la consultation" : "Saisie de la consultation (brouillon)",
  });

  return consultation;
}

export async function getConsultation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "consultation.read");
  return findConsultationDetail(ctx.hospitalId, id);
}

/** Read-only finalize/amend history, composed from append-only audit entries. */
export async function getConsultationHistory(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "consultation.read");
  const consultation = await findConsultationById(ctx.hospitalId, id);
  if (!consultation) throw new Error("Consultation introuvable dans cet hôpital.");
  return findEntityAuditTrail(ctx.hospitalId, "Consultation", id, HISTORY_ACTIONS);
}

/** Finalize a draft consultation (draft → finalized). Rejected if not a draft. */
export async function finalizeConsultation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "consultation.create", { type: "Consultation", id });
  const consultation = await findConsultationById(ctx.hospitalId, id);
  if (!consultation) throw new Error("Consultation introuvable dans cet hôpital.");
  if (!canFinalize(consultation.status as ConsultationStatus)) {
    throw new Error("Cette consultation est déjà finalisée.");
  }
  const updated = await updateConsultation(id, { status: "finalized", updatedById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.consultationFinalize,
    entityType: "Consultation",
    entityId: id,
    summary: "Finalisation de la consultation",
  });
  return updated;
}

/** Amend a FINALIZED consultation — a traced correction (the audit keeps the history). */
export async function amendConsultation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: AmendConsultationInput,
) {
  await requireCapability(actor, ctx, "consultation.create", { type: "Consultation", id });
  const consultation = await findConsultationById(ctx.hospitalId, id);
  if (!consultation) throw new Error("Consultation introuvable dans cet hôpital.");
  if (!canAmend(consultation.status as ConsultationStatus)) {
    throw new Error("Seule une consultation finalisée peut être amendée.");
  }
  const updated = await updateConsultation(id, {
    clinicalNote: input.clinicalNote,
    vitals: input.vitals,
    provisionalDiagnosis: input.provisionalDiagnosis,
    recommendation: input.recommendation,
    updatedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.consultationAmend,
    entityType: "Consultation",
    entityId: id,
    summary: "Amendement de la consultation (correction tracée)",
  });
  return updated;
}
