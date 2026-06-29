"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { approveRefund, cancelRefund, executeRefund } from "@/server/services";

/** Phase 2C — refund voucher lifecycle actions (admin approves/cancels; cashier executes). */

export type RefundFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function approveRefundAction(
  id: string,
  _prev: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await approveRefund(actor, hospital, id);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/remboursements/${id}`);
  return { ok: true };
}

export async function executeRefundAction(
  id: string,
  _prev: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await executeRefund(actor, hospital, id);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/remboursements/${id}`);
  return { ok: true };
}

export async function cancelRefundAction(
  id: string,
  _prev: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation est obligatoire." };
  try {
    await cancelRefund(actor, hospital, id, reason);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/remboursements/${id}`);
  return { ok: true };
}
