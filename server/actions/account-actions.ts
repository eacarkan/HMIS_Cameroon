"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { changeOwnPassword, resetUserPassword } from "@/server/services";

/**
 * Account-security transport actions (Phase 1A Batch 4). Self password change and admin
 * password reset. Validation/policy + audit live in the service layer; no secrets logged.
 */
export type AccountFormState = { error?: string; ok?: boolean };

export async function changePasswordAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const { actor } = await requireActorAndHospital();
  const current = (formData.get("currentPassword") as string) ?? "";
  const next = (formData.get("newPassword") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";
  if (next !== confirm) return { error: "La confirmation ne correspond pas." };
  try {
    await changeOwnPassword(actor, current, next);
  } catch (error) {
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  return { ok: true };
}

export async function resetUserPasswordAction(
  userId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const next = (formData.get("newPassword") as string) ?? "";
  try {
    await resetUserPassword(actor, hospital, userId, next);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à réinitialiser ce mot de passe." };
    }
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/administration/utilisateurs");
  return { ok: true };
}
