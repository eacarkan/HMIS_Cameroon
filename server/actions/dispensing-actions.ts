"use server";

import { redirect } from "next/navigation";
import { userFacingMessage } from "@/lib/errors";
import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { confirmPrescriptionPayment, dispensePrescription } from "@/server/services";

/** Phase 2D-5 — collection-payment confirmation (cashier) + dispensing (pharmacy). */

export type DispenseFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function confirmPaymentAction(
  prescriptionId: string,
  _prev: DispenseFormState,
  formData: FormData,
): Promise<DispenseFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await confirmPrescriptionPayment(actor, hospital, prescriptionId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/ordonnances/${prescriptionId}`);
  return { ok: true };
}

export async function dispenseAction(
  prescriptionId: string,
  _prev: DispenseFormState,
  formData: FormData,
): Promise<DispenseFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  let recordId: string;
  try {
    const record = await dispensePrescription(actor, hospital, prescriptionId);
    recordId = record.id;
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  redirect(`/dispensations/${recordId}`);
}
