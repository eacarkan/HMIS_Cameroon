"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { estimatedBirthDate, validateAgeInput } from "@/lib/patient-identity";
import {
  isDuplicateOverrideConfirmed,
  registrationFingerprint,
  type DuplicateMatchBasis,
} from "@/lib/patient-matching";
import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  correctPatientIdentity,
  createPatientForActor,
  createTemporaryPatient,
  findPatientDuplicatesForActor,
  type CreatePatientInput,
} from "@/server/services";

/**
 * Patient transport actions (09 §4). Validate input (zod) at the edge, then delegate to the
 * service (which authorizes, scopes, generates the number and audits). Phase 2B: a patient
 * may be registered with a DOB **or** an estimated age (mutually exclusive), an optional
 * phone + guardian phone; temporary/unidentified patients and identity correction are
 * separate explicit workflows.
 */
const patientSchema = z.object({
  familyName: z.string().trim().min(1, { message: "Le nom est obligatoire." }),
  givenName: z.string().trim().min(1, { message: "Le prénom est obligatoire." }),
  sex: z.enum(["male", "female"], { message: "Le sexe est obligatoire." }),
  // Phase 2B — DOB is no longer hard-required at the schema level; the action enforces
  // "DOB xor estimated age" via validateAgeInput (French messages).
  dateOfBirth: z.string().trim().optional(),
  estimatedAge: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  residence: z.string().trim().optional(),
});

/** Resolve DOB vs. estimated age into a concrete birth date + flags. Returns an error string
 *  (French) when the input is invalid (both/neither, or an out-of-range estimate). */
function resolveAge(
  dateOfBirth: string | undefined,
  estimatedAgeRaw: string | undefined,
): { dateOfBirth: Date; isEstimatedAge: boolean; estimatedAge: number | null } | { error: string } {
  const estStr = (estimatedAgeRaw ?? "").trim();
  const estimatedAge = estStr ? Number(estStr) : null;
  const check = validateAgeInput({ dateOfBirth, estimatedAge });
  if (!check.ok) return { error: check.error! };
  if (estimatedAge !== null) {
    return {
      dateOfBirth: estimatedBirthDate(estimatedAge, new Date().getFullYear()),
      isEstimatedAge: true,
      estimatedAge,
    };
  }
  return { dateOfBirth: new Date(dateOfBirth as string), isEstimatedAge: false, estimatedAge: null };
}

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
  estimatedAge: string;
  phone: string;
  guardianPhone: string;
  residence: string;
};

export type PatientFormState = {
  errors?: Record<string, string>;
  error?: string;
  /** Likely duplicates found at registration — WARNING ONLY; the user may continue or cancel. */
  duplicates?: PatientDuplicateView[];
  /** Echoed values to repopulate the form when re-rendering with a warning. */
  values?: PatientFormValues;
  /**
   * Fingerprint of the identifying data that produced this warning. The next "create anyway"
   * submit is honoured ONLY if the resubmitted data still matches it (Phase 1A QA — fix 2).
   */
  warnedFingerprint?: string;
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
    estimatedAge: formData.get("estimatedAge"),
    phone: formData.get("phone"),
    guardianPhone: formData.get("guardianPhone"),
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

  const age = resolveAge(parsed.data.dateOfBirth, parsed.data.estimatedAge);
  if ("error" in age) return { errors: { dateOfBirth: age.error } };

  // A "create anyway" override is honoured ONLY when the user explicitly confirmed AND the
  // resubmitted identifying data is the SAME data that was warned about (Phase 1A QA fix 2).
  const currentFingerprint = registrationFingerprint({
    familyName: parsed.data.familyName,
    givenName: parsed.data.givenName,
    dateOfBirth: age.dateOfBirth,
    phone: parsed.data.phone?.trim() || null,
    sex: parsed.data.sex,
  });
  const confirmedDuplicate = isDuplicateOverrideConfirmed({
    confirmIntent: formData.get("confirmDuplicate") === "1",
    warnedFingerprint: _prev.warnedFingerprint,
    currentFingerprint,
  });

  const input: CreatePatientInput = {
    familyName: parsed.data.familyName,
    givenName: parsed.data.givenName,
    sex: parsed.data.sex,
    dateOfBirth: age.dateOfBirth,
    phone: parsed.data.phone?.trim() || null,
    residence: parsed.data.residence?.trim() || null,
    guardianPhone: parsed.data.guardianPhone?.trim() || null,
    estimatedAge: age.estimatedAge,
    isEstimatedAge: age.isEstimatedAge,
  };

  let patientId: string;
  try {
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
          dateOfBirth: parsed.data.dateOfBirth?.trim() ?? "",
          estimatedAge: parsed.data.estimatedAge?.trim() ?? "",
          phone: parsed.data.phone?.trim() ?? "",
          guardianPhone: parsed.data.guardianPhone?.trim() ?? "",
          residence: parsed.data.residence?.trim() ?? "",
        },
        warnedFingerprint: currentFingerprint,
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

/** Create a temporary / unidentified patient via the explicit workflow (Phase 2B). */
export async function createTemporaryPatientAction(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const sex = formData.get("sex");
  if (sex !== "male" && sex !== "female") {
    return { errors: { sex: "Le sexe (apparent) est obligatoire." } };
  }
  const estStr = ((formData.get("estimatedAge") as string) ?? "").trim();
  const estimatedAge = estStr ? Number(estStr) : null;
  if (estimatedAge !== null && (!Number.isInteger(estimatedAge) || estimatedAge < 0 || estimatedAge > 130)) {
    return { errors: { estimatedAge: "L'âge estimé doit être un entier entre 0 et 130." } };
  }

  let patientId: string;
  try {
    const patient = await createTemporaryPatient(actor, hospital, {
      sex,
      estimatedAge,
      phone: ((formData.get("phone") as string) ?? "").trim() || null,
      guardianPhone: ((formData.get("guardianPhone") as string) ?? "").trim() || null,
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

/** Confirm/correct a patient's identity (Phase 2B). Bound: patientId. */
export async function correctPatientIdentityAction(
  patientId: string,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const parsed = patientSchema.safeParse({
    familyName: formData.get("familyName"),
    givenName: formData.get("givenName"),
    sex: formData.get("sex"),
    dateOfBirth: formData.get("dateOfBirth"),
    estimatedAge: formData.get("estimatedAge"),
    phone: formData.get("phone"),
    guardianPhone: formData.get("guardianPhone"),
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
  const age = resolveAge(parsed.data.dateOfBirth, parsed.data.estimatedAge);
  if ("error" in age) return { errors: { dateOfBirth: age.error } };

  try {
    await correctPatientIdentity(actor, hospital, patientId, {
      familyName: parsed.data.familyName,
      givenName: parsed.data.givenName,
      sex: parsed.data.sex,
      dateOfBirth: age.dateOfBirth,
      phone: parsed.data.phone?.trim() || null,
      guardianPhone: parsed.data.guardianPhone?.trim() || null,
      residence: parsed.data.residence?.trim() || null,
      estimatedAge: age.estimatedAge,
      isEstimatedAge: age.isEstimatedAge,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à corriger l'identité du patient." };
    }
    throw error;
  }
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}
