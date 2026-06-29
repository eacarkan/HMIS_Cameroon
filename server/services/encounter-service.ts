import {
  canTransition,
  isEncounterStatus,
  type EncounterStatus,
} from "@/lib/encounter-status";
import { composeTimeline, type TimelineEvent } from "@/lib/patient-timeline";
import {
  createEncounter,
  findEncounterById,
  findEntityAuditTrail,
  findPatientById,
  findPatientTimelineData,
  updateEncounterService,
  updateEncounterStatus,
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

const STATUS_HISTORY_ACTIONS = [
  AUDIT_ACTIONS.encounterCreate,
  AUDIT_ACTIONS.encounterStatusChange,
  AUDIT_ACTIONS.encounterAssign,
];

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

// --- Phase 1A (Batch 1B) encounter lifecycle ---

/** French status labels for audit summaries (UI uses next-intl `encounterStatus`). */
const STATUS_FR: Record<EncounterStatus, string> = {
  open: "Ouverte",
  closed: "Clôturée",
  cancelled: "Annulée",
};

/**
 * Move an encounter to a new status, rejecting invalid transitions (server-side). Every
 * change is audited; the status history is reconstructed from those append-only entries
 * (no dedicated history table).
 */
export async function changeEncounterStatus(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  next: string,
) {
  await requireCapability(actor, ctx, "encounter.create", { type: "Encounter", id });
  if (!isEncounterStatus(next)) throw new Error("Statut de visite inconnu.");

  const encounter = await findEncounterById(ctx.hospitalId, id);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");

  const from = encounter.status as EncounterStatus;
  if (!canTransition(from, next)) {
    throw new Error(
      `Transition de statut invalide : ${STATUS_FR[from]} → ${STATUS_FR[next]}.`,
    );
  }

  const closedAt = next === "open" ? null : new Date();
  const updated = await updateEncounterStatus(id, next, closedAt);

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.encounterStatusChange,
    entityType: "Encounter",
    entityId: id,
    summary: `Visite ${encounter.encounterNumber} : ${STATUS_FR[from]} → ${STATUS_FR[next]}`,
  });
  return updated;
}

/** Assign / re-route the encounter to a service or department (recorded + audited). */
export async function assignEncounterService(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  serviceLabel: string,
) {
  await requireCapability(actor, ctx, "encounter.create", { type: "Encounter", id });
  const encounter = await findEncounterById(ctx.hospitalId, id);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");

  const updated = await updateEncounterService(id, serviceLabel);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.encounterAssign,
    entityType: "Encounter",
    entityId: id,
    summary: `Affectation de la visite ${encounter.encounterNumber} au service « ${serviceLabel} »`,
  });
  return updated;
}

/** Read-only status history for an encounter, composed from append-only audit entries. */
export async function getEncounterStatusHistory(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "encounter.read");
  const encounter = await findEncounterById(ctx.hospitalId, id);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  return findEntityAuditTrail(ctx.hospitalId, "Encounter", id, STATUS_HISTORY_ACTIONS);
}

/** Read-only, chronological patient timeline (composed from existing records). */
export async function getPatientTimeline(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
): Promise<TimelineEvent[]> {
  await requireCapability(actor, ctx, "patient.read");
  const patient = await findPatientTimelineData(ctx.hospitalId, patientId);
  if (!patient) throw new Error("Patient introuvable dans cet hôpital.");
  return composeTimeline(patient);
}
