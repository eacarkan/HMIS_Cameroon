"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  addPatientContact,
  deactivatePatientContact,
  addPatientIdentifier,
  deactivatePatientIdentifier,
  reviewDuplicateCandidate,
} from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * Patient identity/contact transport actions (Gate 4). Delegate to the Gate 3
 * `patient-identity-service` (reception manages ADMINISTRATIVE identity/contact only;
 * hospital-scoped through the patient; audited). No merge, no MPI, no survivorship — the
 * duplicate flow is review-only.
 */
const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier l'identité du patient.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function addPatientContactAction(
  patientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const contactType = (formData.get("contactType") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  const label = (formData.get("label") as string)?.trim() || null;
  if (!contactType || !value) {
    return { errors: { value: "Le type et la valeur sont obligatoires." } };
  }
  try {
    await addPatientContact(actor, hospital, patientId, { contactType, value, label });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deactivatePatientContactAction(
  patientId: string,
  id: string,
): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivatePatientContact(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(`/patients/${patientId}`);
}

export async function addPatientIdentifierAction(
  patientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const identifierType = (formData.get("identifierType") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  const issuingAuthority = (formData.get("issuingAuthority") as string)?.trim() || null;
  if (!identifierType || !value) {
    return { errors: { value: "Le type et la valeur sont obligatoires." } };
  }
  try {
    await addPatientIdentifier(actor, hospital, patientId, {
      identifierType,
      value,
      issuingAuthority,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

export async function deactivatePatientIdentifierAction(
  patientId: string,
  id: string,
): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivatePatientIdentifier(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(`/patients/${patientId}`);
}

/** Review-only — never merges patients. */
export async function reviewDuplicateCandidateAction(
  patientId: string,
  id: string,
  status: "dismissed" | "flagged" | "open",
): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await reviewDuplicateCandidate(actor, hospital, id, status);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(`/patients/${patientId}`);
}
