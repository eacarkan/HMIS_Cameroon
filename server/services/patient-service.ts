import { Prisma, type Sex } from "@prisma/client";

import {
  classifyDuplicates,
  type DuplicateMatchBasis,
} from "@/lib/patient-matching";
import {
  estimatedBirthDate,
  nextTemporarySeq,
  temporaryIdDayPrefix,
  temporaryIdentifierFor,
} from "@/lib/patient-identity";
import {
  listTemporaryIdentifiersForDay,
  createPatient,
  findPatientById,
  findPotentialDuplicatePatients,
  searchPatientsAdvanced,
  updatePatient,
  type HospitalContext,
  type PatientSearchFilters,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Patient service (09 §4). Each use-case authorizes (capability), enforces hospital
 * scoping (via the data-access functions), and audits significant changes.
 *
 * Phase 1A Batch 1A: structured search (name/phone/identifier/sex) and conservative,
 * WARNING-ONLY duplicate detection at registration — never merges, never blocks, never
 * decides identity automatically; the warning event is audited when overridden.
 */

export type CreatePatientInput = {
  familyName: string;
  givenName: string;
  sex: Sex;
  /** When the DOB is unknown, the action derives this from an estimated age (Jan 1 of the
   *  approximate birth year) and sets `isEstimatedAge`. */
  dateOfBirth: Date;
  phone: string | null;
  residence: string | null;
  // Phase 2B — additive identity fields.
  guardianPhone?: string | null;
  estimatedAge?: number | null;
  isEstimatedAge?: boolean;
};

/** A surfaced duplicate hint: the existing patient plus why it was flagged. */
export type PatientDuplicateHit = {
  id: string;
  patientNumber: string;
  familyName: string;
  givenName: string;
  sex: Sex;
  dateOfBirth: Date;
  basis: DuplicateMatchBasis;
};

export async function searchPatientsForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  filters: string | PatientSearchFilters,
) {
  await requireCapability(actor, ctx, "patient.read");
  const normalized: PatientSearchFilters =
    typeof filters === "string" ? { query: filters } : filters;
  return searchPatientsAdvanced(ctx.hospitalId, normalized);
}

export async function getPatient(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "patient.read");
  return findPatientById(ctx.hospitalId, id);
}

/**
 * Find likely-duplicate existing patients for the given registration input. Hospital-scoped
 * read (patient.read). Returns WARNING-ONLY hints — the caller decides whether to continue;
 * the service never merges, blocks, or decides identity.
 */
export async function findPatientDuplicatesForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: CreatePatientInput,
): Promise<PatientDuplicateHit[]> {
  await requireCapability(actor, ctx, "patient.read");
  const candidates = await findPotentialDuplicatePatients(ctx.hospitalId, {
    familyName: input.familyName,
    givenName: input.givenName,
    dateOfBirth: input.dateOfBirth,
    phone: input.phone,
  });
  const matches = classifyDuplicates(
    {
      familyName: input.familyName,
      givenName: input.givenName,
      dateOfBirth: input.dateOfBirth,
      phone: input.phone,
    },
    candidates,
  );
  return matches.map(({ patient, basis }) => ({
    id: patient.id,
    patientNumber: patient.patientNumber,
    familyName: patient.familyName,
    givenName: patient.givenName,
    sex: patient.sex,
    dateOfBirth: patient.dateOfBirth,
    basis,
  }));
}

export async function createPatientForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: CreatePatientInput,
  /**
   * Set when the user is creating despite a duplicate warning. Records an auditable
   * `patient_duplicate.warning` event referencing the matched candidates and basis.
   * No merge, no block — the new patient is created normally.
   */
  duplicateOverride?: { basis: DuplicateMatchBasis; candidatePatientNumbers: string[] },
) {
  await requireCapability(actor, ctx, "patient.create");

  const year = new Date().getFullYear();
  const patientNumber = await generateNumber(ctx, "patient", year);

  const patient = await createPatient({
    hospitalId: ctx.hospitalId,
    patientNumber,
    familyName: input.familyName,
    givenName: input.givenName,
    sex: input.sex,
    dateOfBirth: input.dateOfBirth,
    phone: input.phone,
    residence: input.residence,
    guardianPhone: input.guardianPhone ?? null,
    estimatedAge: input.estimatedAge ?? null,
    isEstimatedAge: input.isEstimatedAge ?? false,
    createdById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientCreate,
    entityType: "Patient",
    entityId: patient.id,
    summary: `Création du patient ${patient.givenName} ${patient.familyName}`,
  });

  if (duplicateOverride && duplicateOverride.candidatePatientNumbers.length > 0) {
    const list = duplicateOverride.candidatePatientNumbers.join(", ");
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.patientDuplicateWarning,
      entityType: "Patient",
      entityId: patient.id,
      summary: `Doublon possible signalé à l'enregistrement (${duplicateOverride.basis}; ${list}) — enregistrement poursuivi par l'utilisateur, aucune fusion`,
    });
  }

  return patient;
}

/**
 * Create a TEMPORARY / unidentified patient (Phase 2B) via the explicit workflow. Generates
 * `Inconnu_YYMMDD_NN` (per hospital + day), flags `isTemporaryIdentity`, and retains the
 * original temporary identifier (also recorded in the audit). A normal patient number is
 * still allocated; identity is confirmed later via `correctPatientIdentity`.
 */
export async function createTemporaryPatient(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: {
    sex: Sex;
    estimatedAge?: number | null;
    phone?: string | null;
    guardianPhone?: string | null;
  },
) {
  await requireCapability(actor, ctx, "patient.create");

  const now = new Date();
  const year = now.getFullYear();
  const dayPrefix = temporaryIdDayPrefix(now);
  const patientNumber = await generateNumber(ctx, "patient", year);

  const hasEstimate = input.estimatedAge != null;
  const dateOfBirth = hasEstimate
    ? estimatedBirthDate(input.estimatedAge as number, year)
    : new Date(Date.UTC(1900, 0, 1)); // unknown-DOB sentinel for a temporary record

  // Phase 3F-5 — concurrency-safe temporary numbering. The `Inconnu_YYMMDD_NN` sequence is computed
  // from a live count, so two concurrent creations could pick the same NN; the partial unique index
  // `Patient_temporary_identifier_unique` makes the clash a P2002 we retry (recompute the count → the
  // winner has committed, so the next number is free). Mirrors the 2F queue-ticket numbering pattern.
  let patient: Awaited<ReturnType<typeof createPatient>> | null = null;
  let temporaryId = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    // MAX(suffix)+1 (not count+1): gap-tolerant, so a future deletion/void can never reproduce a
    // taken number; under concurrency the winner has committed by the retry, so the next is free.
    const existing = await listTemporaryIdentifiersForDay(ctx.hospitalId, dayPrefix);
    const seq = nextTemporarySeq(existing, dayPrefix);
    temporaryId = temporaryIdentifierFor(now, seq);
    try {
      patient = await createPatient({
        hospitalId: ctx.hospitalId,
        patientNumber,
        familyName: "Inconnu",
        givenName: temporaryId,
        sex: input.sex,
        dateOfBirth,
        phone: input.phone ?? null,
        residence: null,
        guardianPhone: input.guardianPhone ?? null,
        estimatedAge: input.estimatedAge ?? null,
        isEstimatedAge: hasEstimate,
        isTemporaryIdentity: true,
        temporaryIdentifier: temporaryId,
        createdById: actor.id,
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 5
      ) {
        continue; // the temporary identifier was taken concurrently — recompute and retry
      }
      throw error;
    }
  }
  if (!patient) throw new Error("Impossible d'attribuer un identifiant temporaire unique. Réessayez.");

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientTemporaryCreated,
    entityType: "Patient",
    entityId: patient.id,
    summary: `Création d'un patient temporaire ${temporaryId} (${patient.patientNumber})`,
  });

  return patient;
}

/**
 * Phase 3F-5 — record a `patient.dob_validation_failed` audit when a date of birth is rejected
 * (strict `YYYY-MM-DD` / future / >130y). No patient row is created; the actions call this on a
 * validation failure so the edge case leaves an audit trail. Keeps audit-writing in the service.
 */
export async function auditDobValidationFailure(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  reason: string,
) {
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientDobValidationFailed,
    entityType: "Patient",
    entityId: null,
    summary: `Date de naissance refusée : ${reason}`,
  });
}

export type CorrectPatientIdentityInput = {
  familyName: string;
  givenName: string;
  sex: Sex;
  dateOfBirth: Date;
  phone: string | null;
  guardianPhone?: string | null;
  residence?: string | null;
  estimatedAge?: number | null;
  isEstimatedAge?: boolean;
};

/**
 * Confirm/correct a patient's identity (Phase 2B). Updates the profile and clears the
 * temporary flag, but NEVER changes the original `temporaryIdentifier` — and the audit event
 * retains that original temporary ID forever, linked to the patient.
 */
export async function correctPatientIdentity(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: CorrectPatientIdentityInput,
) {
  await requireCapability(actor, ctx, "patient.identity.manage", { type: "Patient", id });
  const existing = await findPatientById(ctx.hospitalId, id);
  if (!existing) throw new Error("Patient introuvable dans cet hôpital.");

  const updated = await updatePatient(ctx.hospitalId, id, {
    familyName: input.familyName,
    givenName: input.givenName,
    sex: input.sex,
    dateOfBirth: input.dateOfBirth,
    phone: input.phone,
    guardianPhone: input.guardianPhone ?? null,
    residence: input.residence ?? null,
    estimatedAge: input.estimatedAge ?? null,
    isEstimatedAge: input.isEstimatedAge ?? false,
    isTemporaryIdentity: false,
    updatedById: actor.id,
  });

  const originalTempId = existing.temporaryIdentifier;
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.patientIdentityUpdated,
    entityType: "Patient",
    entityId: id,
    summary: originalTempId
      ? `Identité confirmée pour ${input.givenName} ${input.familyName} — ID temporaire d'origine conservé : ${originalTempId}`
      : `Mise à jour de l'identité du patient ${input.givenName} ${input.familyName}`,
  });

  return updated;
}
