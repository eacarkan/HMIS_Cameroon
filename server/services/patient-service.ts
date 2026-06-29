import type { Sex } from "@prisma/client";

import {
  classifyDuplicates,
  type DuplicateMatchBasis,
} from "@/lib/patient-matching";
import {
  createPatient,
  findPatientById,
  findPotentialDuplicatePatients,
  searchPatientsAdvanced,
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
  dateOfBirth: Date;
  phone: string | null;
  residence: string | null;
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
