"use server";

import { redirect } from "next/navigation";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { createPatientForActor } from "@/server/services";

/**
 * Patient transport actions (09 §4). Validate input (zod) at the edge, then delegate
 * to the service (which authorizes, scopes, generates the number and audits).
 */
const patientSchema = z.object({
  familyName: z.string().trim().min(1, { message: "Le nom est obligatoire." }),
  givenName: z
    .string()
    .trim()
    .min(1, { message: "Le prénom est obligatoire." }),
  sex: z.enum(["male", "female"], { message: "Le sexe est obligatoire." }),
  dateOfBirth: z
    .string()
    .min(1, { message: "La date de naissance est obligatoire." }),
  phone: z.string().trim().optional(),
  residence: z.string().trim().optional(),
});

export type PatientFormState = {
  errors?: Record<string, string>;
  error?: string;
};

export async function createPatientAction(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const parsed = patientSchema.safeParse({
    familyName: formData.get("familyName"),
    givenName: formData.get("givenName"),
    sex: formData.get("sex"),
    dateOfBirth: formData.get("dateOfBirth"),
    phone: formData.get("phone"),
    residence: formData.get("residence"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) errors[key] = messages[0];
    }
    return { errors };
  }

  let patientId: string;
  try {
    const patient = await createPatientForActor(actor, hospital, {
      familyName: parsed.data.familyName,
      givenName: parsed.data.givenName,
      sex: parsed.data.sex,
      dateOfBirth: new Date(parsed.data.dateOfBirth),
      phone: parsed.data.phone?.trim() || null,
      residence: parsed.data.residence?.trim() || null,
    });
    patientId = patient.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à créer un patient." };
    }
    throw error;
  }

  redirect(`/patients/${patientId}`);
}
