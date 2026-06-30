"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  assignWard,
  authorizeDischarge,
  cancelAdmission,
  generateDailyWardCharge,
  requestAdmission,
  requestDischarge,
} from "@/server/services";

/** Phase 2G — ward-level hospitalization actions (request / assign ward / daily fee / discharge). */

export type AdmissionFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

function toState(error: unknown): AdmissionFormState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

export async function requestAdmissionAction(
  encounterId: string,
  _prev: AdmissionFormState,
  formData: FormData,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  try {
    await requestAdmission(actor, hospital, encounterId, { reason });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function assignWardAction(
  encounterId: string,
  admissionId: string,
  _prev: AdmissionFormState,
  formData: FormData,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const wardServiceUnitId = ((formData.get("wardServiceUnitId") as string) ?? "").trim();
  if (!wardServiceUnitId) return { error: "Sélectionnez un service d'hospitalisation." };
  try {
    await assignWard(actor, hospital, admissionId, { wardServiceUnitId });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function generateDailyChargeAction(
  encounterId: string,
  admissionId: string,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await generateDailyWardCharge(actor, hospital, admissionId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function requestDischargeAction(
  encounterId: string,
  admissionId: string,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await requestDischarge(actor, hospital, admissionId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function authorizeDischargeAction(
  encounterId: string,
  admissionId: string,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await authorizeDischarge(actor, hospital, admissionId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function cancelAdmissionAction(
  encounterId: string,
  admissionId: string,
  _prev: AdmissionFormState,
  formData: FormData,
): Promise<AdmissionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation est obligatoire." };
  try {
    await cancelAdmission(actor, hospital, admissionId, reason);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}
