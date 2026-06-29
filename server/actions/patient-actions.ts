"use server";

import { redirect } from "next/navigation";

import type { DuplicateMatchBasis } from "@/lib/patient-matching";
import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createPatientForActor,
  findPatientDuplicatesForActor,
  type CreatePatientInput,
} from "@/server/services";

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

/** A surfaced likely-duplicate (serializable view for the form). */
export type PatientDuplicateView = {
  id: string;
  patientNumber: string;
  fullName: string;
  basis: DuplicateMatchBasis;
};

/** The submitted values, echoed back so the form survives React 19's post-action reset. */
export type PatientFormValues = {
  familyName: string;
  givenName: string;
  sex: string;
  dateOfBirth: string;
  phone: string;
  residence: string;
};

export type PatientFormState = {
  errors?: Record<string, string>;
  error?: string;
  /** Likely duplicates found at registration — WARNING ONLY; the user may continue or cancel. */
  duplicates?: PatientDuplicateView[];
  /** Echoed values to repopulate the form when re-rendering with a warning. */
  values?: PatientFormValues;
};

export async function createPatientAction(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  // The user has already seen the duplicate warning for the previous submission, or
  // explicitly confirmed via the form — either way they have acknowledged it.
  const alreadyWarned = (_prev.duplicates?.length ?? 0) > 0;

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

  // The user has acknowledged a previously-shown duplicate warning and chose to continue.
  const confirmedDuplicate = alreadyWarned || formData.get("confirmDuplicate") === "1";

  const input: CreatePatientInput = {
    familyName: parsed.data.familyName,
    givenName: parsed.data.givenName,
    sex: parsed.data.sex,
    dateOfBirth: new Date(parsed.data.dateOfBirth),
    phone: parsed.data.phone?.trim() || null,
    residence: parsed.data.residence?.trim() || null,
  };

  let patientId: string;
  try {
    // Conservative, WARNING-ONLY duplicate detection. Never merges, never blocks.
    const hits = await findPatientDuplicatesForActor(actor, hospital, input);
    if (hits.length > 0 && !confirmedDuplicate) {
      return {
        duplicates: hits.map((h) => ({
          id: h.id,
          patientNumber: h.patientNumber,
          fullName: `${h.givenName} ${h.familyName}`,
          basis: h.basis,
        })),
        values: {
          familyName: parsed.data.familyName,
          givenName: parsed.data.givenName,
          sex: parsed.data.sex,
          dateOfBirth: parsed.data.dateOfBirth,
          phone: parsed.data.phone?.trim() ?? "",
          residence: parsed.data.residence?.trim() ?? "",
        },
      };
    }

    const patient = await createPatientForActor(
      actor,
      hospital,
      input,
      hits.length > 0
        ? { basis: hits[0].basis, candidatePatientNumbers: hits.map((h) => h.patientNumber) }
        : undefined,
    );
    patientId = patient.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à créer un patient." };
    }
    throw error;
  }

  redirect(`/patients/${patientId}`);
}
