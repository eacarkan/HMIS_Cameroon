import {
  type HospitalContext,
  findPatientById,
  listPatientContacts as dbListPatientContacts,
  createPatientContact as dbCreatePatientContact,
  findPatientContactById,
  updatePatientContact as dbUpdatePatientContact,
  listPatientIdentifiers as dbListPatientIdentifiers,
  createPatientIdentifier as dbCreatePatientIdentifier,
  findPatientIdentifierById,
  updatePatientIdentifier as dbUpdatePatientIdentifier,
  createDuplicateCandidate as dbCreateDuplicateCandidate,
  listDuplicateCandidates as dbListDuplicateCandidates,
  findDuplicateCandidateById,
  updateDuplicateCandidateStatus,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Patient identity / contact service (Gate 3, 23 §5). Reception (ACC) manages
 * ADMINISTRATIVE identity/contact only — never the clinical file. Hospital scoping is
 * enforced THROUGH the patient (the patient must belong to the active hospital).
 * No MPI, no merge, no survivorship, no global de-duplication — the duplicate candidate
 * is warning/review only. Identifier uniqueness stays hospital-local (`à confirmer`).
 */

async function requirePatientInHospital(ctx: HospitalContext, patientId: string) {
  const patient = await findPatientById(ctx.hospitalId, patientId);
  if (!patient) throw new Error("Patient introuvable dans cet hôpital.");
  return patient;
}

// ---- Contacts ----
export async function listPatientContacts(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
) {
  await requireCapability(actor, ctx, "patient.identity.read");
  await requirePatientInHospital(ctx, patientId);
  return dbListPatientContacts(ctx.hospitalId, patientId);
}

export async function addPatientContact(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
  input: { contactType: string; value: string; label?: string | null },
) {
  await requireCapability(actor, ctx, "patient.identity.manage", { type: "PatientContact" });
  await requirePatientInHospital(ctx, patientId);
  const contact = await dbCreatePatientContact({
    hospitalId: ctx.hospitalId,
    patientId,
    contactType: input.contactType,
    value: input.value,
    label: input.label ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientContactCreate,
    entityType: "PatientContact",
    entityId: contact.id,
    summary: `Ajout d'un contact patient (${input.contactType})`,
  });
  return contact;
}

export async function deactivatePatientContact(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "patient.identity.manage", { type: "PatientContact", id });
  const existing = await findPatientContactById(ctx.hospitalId, id);
  if (!existing) throw new Error("Contact introuvable dans cet hôpital.");
  const contact = await dbUpdatePatientContact(id, { deletedAt: new Date() });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientContactDeactivate,
    entityType: "PatientContact",
    entityId: id,
    summary: "Désactivation d'un contact patient",
  });
  return contact;
}

// ---- Identifiers (hospital-local uniqueness; NO national MPI) ----
export async function listPatientIdentifiers(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
) {
  await requireCapability(actor, ctx, "patient.identity.read");
  await requirePatientInHospital(ctx, patientId);
  return dbListPatientIdentifiers(ctx.hospitalId, patientId);
}

export async function addPatientIdentifier(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
  input: { identifierType: string; value: string; issuingAuthority?: string | null },
) {
  await requireCapability(actor, ctx, "patient.identity.manage", { type: "PatientIdentifier" });
  await requirePatientInHospital(ctx, patientId);
  const identifier = await dbCreatePatientIdentifier({
    hospitalId: ctx.hospitalId,
    patientId,
    identifierType: input.identifierType,
    value: input.value,
    issuingAuthority: input.issuingAuthority ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientIdentifierCreate,
    entityType: "PatientIdentifier",
    entityId: identifier.id,
    summary: `Ajout d'un identifiant patient (${input.identifierType})`,
  });
  return identifier;
}

export async function deactivatePatientIdentifier(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "patient.identity.manage", { type: "PatientIdentifier", id });
  const existing = await findPatientIdentifierById(ctx.hospitalId, id);
  if (!existing) throw new Error("Identifiant introuvable dans cet hôpital.");
  const identifier = await dbUpdatePatientIdentifier(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientIdentifierDeactivate,
    entityType: "PatientIdentifier",
    entityId: id,
    summary: "Désactivation d'un identifiant patient",
  });
  return identifier;
}

// ---- Duplicate candidate (WARNING / REVIEW ONLY — never merges patients) ----

/** Read-only review queue of persisted duplicate hints for the active hospital. */
export async function listDuplicateCandidatesForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "patient.duplicate.manage");
  return dbListDuplicateCandidates(ctx.hospitalId);
}

export async function flagDuplicateCandidate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  patientId: string,
  candidatePatientId: string,
  matchBasis: string,
) {
  await requireCapability(actor, ctx, "patient.duplicate.manage", { type: "PatientDuplicateCandidate" });
  await requirePatientInHospital(ctx, patientId);
  await requirePatientInHospital(ctx, candidatePatientId);
  const candidate = await dbCreateDuplicateCandidate({
    hospitalId: ctx.hospitalId,
    patientId,
    candidatePatientId,
    matchBasis,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientDuplicateWarning,
    entityType: "Patient",
    entityId: patientId,
    summary: `Doublon possible signalé (${matchBasis}) — avertissement, aucune fusion`,
  });
  return candidate;
}

/** Update the review status only (open/dismissed/flagged). Never merges or deletes patients. */
export async function reviewDuplicateCandidate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  status: "dismissed" | "flagged" | "open",
) {
  await requireCapability(actor, ctx, "patient.duplicate.manage", { type: "PatientDuplicateCandidate", id });
  const existing = await findDuplicateCandidateById(ctx.hospitalId, id);
  if (!existing) throw new Error("Candidat doublon introuvable dans cet hôpital.");
  const candidate = await updateDuplicateCandidateStatus(id, status);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientDuplicateReview,
    entityType: "PatientDuplicateCandidate",
    entityId: id,
    summary: `Revue de doublon : ${status} (aucune fusion)`,
  });
  return candidate;
}
