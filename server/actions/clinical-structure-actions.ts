"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { addObservation, addDiagnosis } from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * Clinical-structure transport actions (Gate 4). Delegate to the Gate 3
 * `clinical-structure-service` (clinician-only; hospital-scoped through the consultation;
 * audited). Free-text consultation fields are untouched (dual-run). No prescription, no
 * Practitioner, no finalization workflow. `encounterId` is used only to revalidate the page.
 */
const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier les données cliniques.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

export async function addObservationAction(
  encounterId: string,
  consultationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const type = (formData.get("type") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  const unit = (formData.get("unit") as string)?.trim() || null;
  if (!type || !value) {
    return { errors: { value: "Le type et la valeur sont obligatoires." } };
  }
  try {
    await addObservation(actor, hospital, consultationId, { type, value, unit });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function addDiagnosisAction(
  encounterId: string,
  consultationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const label = (formData.get("label") as string)?.trim();
  const code = (formData.get("code") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";
  if (!label) {
    return { errors: { label: "Le libellé est obligatoire." } };
  }
  try {
    await addDiagnosis(actor, hospital, consultationId, { label, code, isPrimary });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}
