"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { overrideReservationBatch } from "@/server/services";

/** Phase 2D-6 — Pharmacist-in-Charge FEFO override action (re-point a reservation to a chosen batch). */

export type FefoFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function overrideFefoAction(
  prescriptionId: string,
  reservationId: string,
  _prev: FefoFormState,
  formData: FormData,
): Promise<FefoFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const toBatchId = ((formData.get("toBatchId") as string) ?? "").trim();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!toBatchId) return { error: "Veuillez choisir un lot." };
  if (!reason) return { error: "Le motif de la dérogation FEFO est obligatoire." };
  try {
    await overrideReservationBatch(actor, hospital, { prescriptionId, reservationId, toBatchId, reason });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/ordonnances/${prescriptionId}`);
  return { ok: true };
}
