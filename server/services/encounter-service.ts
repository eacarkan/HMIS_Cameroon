import {
  createEncounter,
  findEncounterById,
  findPatientById,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/** Encounter service (09 §4): authorize, scope, number, audit. */

export type OpenEncounterInput = {
  serviceLabel: string;
  reason: string;
};

export async function getEncounter(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "encounter.read");
  return findEncounterById(ctx.hospitalId, id);
}

export async function openEncounter(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
  input: OpenEncounterInput,
) {
  await requireCapability(actor, ctx, "encounter.create");

  const patient = await findPatientById(ctx.hospitalId, patientId);
  if (!patient) throw new Error("Patient introuvable dans cet hôpital.");

  const year = new Date().getFullYear();
  const encounterNumber = await generateNumber(ctx, "encounter", year);

  const encounter = await createEncounter({
    hospitalId: ctx.hospitalId,
    patientId,
    encounterNumber,
    serviceLabel: input.serviceLabel,
    reason: input.reason,
    assignedToId: null,
    createdById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.encounterCreate,
    entityType: "Encounter",
    entityId: encounter.id,
    summary: `Ouverture de la visite ${encounter.encounterNumber}`,
  });

  return encounter;
}
