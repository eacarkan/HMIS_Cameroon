"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  approveInvoiceCancellation,
  rejectInvoiceCancellation,
  requestInvoiceCancellation,
} from "@/server/services";

/** Phase 2C — invoice cancellation workflow actions (cashier requests; admin decides). */

export type CancellationFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

/** Cashier requests an invoice cancellation (bound: invoiceId). Mandatory reason. */
export async function requestCancellationAction(
  invoiceId: string,
  _prev: CancellationFormState,
  formData: FormData,
): Promise<CancellationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation est obligatoire." };
  try {
    await requestInvoiceCancellation(actor, hospital, invoiceId, reason);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/factures/${invoiceId}`);
  return { ok: true };
}

/** Administrator approves a cancellation request (bound: requestId). */
export async function approveCancellationAction(
  requestId: string,
  _prev: CancellationFormState,
  formData: FormData,
): Promise<CancellationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const decisionReason = ((formData.get("decisionReason") as string) ?? "").trim();
  try {
    await approveInvoiceCancellation(actor, hospital, requestId, decisionReason || undefined);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/annulations");
  return { ok: true };
}

/** Administrator rejects a cancellation request (bound: requestId). Mandatory decision reason. */
export async function rejectCancellationAction(
  requestId: string,
  _prev: CancellationFormState,
  formData: FormData,
): Promise<CancellationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const decisionReason = ((formData.get("decisionReason") as string) ?? "").trim();
  if (!decisionReason) return { error: "Le motif de rejet est obligatoire." };
  try {
    await rejectInvoiceCancellation(actor, hospital, requestId, decisionReason);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/annulations");
  return { ok: true };
}
