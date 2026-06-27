"use server";

import { redirect } from "next/navigation";

import { fieldErrorsOf, z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { openEncounter } from "@/server/services";

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
    throw error;
  }

  redirect(`/encounters/${encounterId}`);
}
