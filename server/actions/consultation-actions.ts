"use server";

import { redirect } from "next/navigation";

import { fieldErrorsOf, z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { recordConsultation } from "@/server/services";

const consultationSchema = z.object({
  reason: z.string().trim().min(1, { message: "Le motif est obligatoire." }),
  clinicalNote: z.string().trim().optional(),
  vitals: z.string().trim().optional(),
  provisionalDiagnosis: z.string().trim().optional(),
  recommendation: z.string().trim().optional(),
});

export type ConsultationFormState = {
  errors?: Record<string, string>;
  error?: string;
};

export async function recordConsultationAction(
  encounterId: string,
  _prev: ConsultationFormState,
  formData: FormData,
): Promise<ConsultationFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const parsed = consultationSchema.safeParse({
    reason: formData.get("reason"),
    clinicalNote: formData.get("clinicalNote"),
    vitals: formData.get("vitals"),
    provisionalDiagnosis: formData.get("provisionalDiagnosis"),
    recommendation: formData.get("recommendation"),
  });
  if (!parsed.success) return { errors: fieldErrorsOf(parsed.error) };

  try {
    await recordConsultation(actor, hospital, encounterId, {
      reason: parsed.data.reason,
      clinicalNote: parsed.data.clinicalNote?.trim() || null,
      vitals: parsed.data.vitals?.trim() || null,
      provisionalDiagnosis: parsed.data.provisionalDiagnosis?.trim() || null,
      recommendation: parsed.data.recommendation?.trim() || null,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à saisir une consultation." };
    }
    throw error;
  }

  redirect(`/encounters/${encounterId}`);
}
