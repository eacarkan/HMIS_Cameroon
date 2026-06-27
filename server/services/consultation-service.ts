import {
  createConsultation,
  findEncounterById,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/** Consultation service (09 §4) — minimal: reason + free-text fields (05 §4). */

export type RecordConsultationInput = {
  reason: string;
  clinicalNote: string | null;
  vitals: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
};

export async function recordConsultation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
  input: RecordConsultationInput,
) {
  await requireCapability(actor, ctx, "consultation.create");

  const encounter = await findEncounterById(ctx.hospitalId, encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");

  const consultation = await createConsultation({
    hospitalId: ctx.hospitalId,
    encounterId,
    status: "finalized",
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
    summary: "Saisie de la consultation",
  });

  return consultation;
}
