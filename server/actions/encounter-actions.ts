"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { fieldErrorsOf, z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  assignEncounterService,
  changeEncounterStatus,
  openEncounter,
} from "@/server/services";

const encounterSchema = z.object({
  serviceLabel: z
    .string()
    .trim()
    .min(1, { message: "Le service est obligatoire." }),
  reason: z.string().trim().min(1, { message: "Le motif est obligatoire." }),
});

export type EncounterFormState = {
  errors?: Record<string, string>;
  error?: string;
};

export async function openEncounterAction(
  patientId: string,
  _prev: EncounterFormState,
  formData: FormData,
): Promise<EncounterFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const parsed = encounterSchema.safeParse({
    serviceLabel: formData.get("serviceLabel"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error) };

  let encounterId: string;
  try {
    const encounter = await openEncounter(
      actor,
      hospital,
      patientId,
      parsed.data,
    );
    encounterId = encounter.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à ouvrir une visite." };
    }
    // Phase 2 QA (follow-up) — surface server-side validation rejections (e.g. a tampered
    // serviceLabel that is not an eligible outpatient consultation service) as a controlled form
    // error instead of an unhandled 500. No encounter is created in that case.
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  redirect(`/encounters/${encounterId}`);
}

// --- Phase 1A (Batch 1B) encounter lifecycle actions ---

const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier cette visite.";

/** Change an encounter's status (bound: encounterId, next). Surfaces invalid-transition errors. */
export async function changeEncounterStatusAction(
  encounterId: string,
  next: string,
  _prev: EncounterFormState,
  formData: FormData,
): Promise<EncounterFormState> {
  void formData; // bound args carry the inputs
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await changeEncounterStatus(actor, hospital, encounterId, next);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return {};
}

const assignSchema = z.object({
  serviceLabel: z.string().trim().min(1, { message: "Le service est obligatoire." }),
});

/** Assign the encounter's service/department (bound: encounterId). */
export async function assignEncounterServiceAction(
  encounterId: string,
  _prev: EncounterFormState,
  formData: FormData,
): Promise<EncounterFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const parsed = assignSchema.safeParse({ serviceLabel: formData.get("serviceLabel") });
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error) };
  try {
    await assignEncounterService(actor, hospital, encounterId, parsed.data.serviceLabel);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return {};
}
