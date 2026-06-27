import type { Sex } from "@prisma/client";

import {
  createPatient,
  findPatientById,
  searchPatients,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Patient service (09 §4). Each use-case authorizes (capability), enforces hospital
 * scoping (via the data-access functions), and audits significant changes.
 */

export type CreatePatientInput = {
  familyName: string;
  givenName: string;
  sex: Sex;
  dateOfBirth: Date;
  phone: string | null;
  residence: string | null;
};

export async function searchPatientsForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  query: string,
) {
  await requireCapability(actor, ctx, "patient.read");
  return searchPatients(ctx.hospitalId, query);
}

export async function getPatient(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "patient.read");
  return findPatientById(ctx.hospitalId, id);
}

export async function createPatientForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: CreatePatientInput,
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

  return patient;
}
