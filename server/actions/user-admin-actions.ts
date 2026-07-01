"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createUserForActor,
  setUserActive,
  assignRoleForActor,
  removeRoleForActor,
} from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * User/account lifecycle transport actions (Gate 5B). Thin: validate → Gate 5B
 * `user-admin-service` (admin-only, hospital-scoped, audited) → revalidate. No Prisma here.
 */
const USERS_PATH = "/administration/utilisateurs";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à gérer les utilisateurs.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const displayName = (formData.get("displayName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const roleCode = (formData.get("roleCode") as string) ?? "";
  if (!displayName || !email) {
    return { errors: { email: "Le nom et l'e-mail sont obligatoires." } };
  }
  try {
    await createUserForActor(actor, hospital, { displayName, email, password, roleCode });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserActiveAction(
  userId: string,
  active: boolean,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void formData; // no form fields — userId/active arrive via bound args
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setUserActive(actor, hospital, userId, active);
  } catch (e) {
    return fail(e); // surface admin-lockout / French message instead of crashing
  }
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function assignRoleAction(
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const roleCode = (formData.get("roleCode") as string) ?? "";
  if (!roleCode) return { error: "Rôle requis." };
  try {
    await assignRoleForActor(actor, hospital, userId, roleCode);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function removeRoleAction(
  userId: string,
  roleCode: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void formData; // no form fields — userId/roleCode arrive via bound args
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await removeRoleForActor(actor, hospital, userId, roleCode);
  } catch (e) {
    return fail(e); // surface admin-lockout / French message instead of crashing
  }
  revalidatePath(USERS_PATH);
  return { ok: true };
}
