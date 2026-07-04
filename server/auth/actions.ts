"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { AUDIT_ACTIONS, recordAudit, selectHospital } from "@/server/services";
import { signIn, signOut } from "./config";
import { getCurrentActor } from "./index";
import { ACTIVE_HOSPITAL_COOKIE } from "./active-hospital";

/**
 * Auth transport actions (09 §4). Thin: validation + Auth.js sign-in/out + the
 * active-hospital cookie. Credential verification, access checks and audit live in
 * the service layer.
 */

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    // Auth.js throws a redirect on success — that must propagate.
    if (error instanceof AuthError) {
      return { error: "Identifiant ou mot de passe incorrect." };
    }
    throw error;
  }
}

export async function signOutAction() {
  const cookieStore = await cookies();
  // Audit the logout (Gate 5B) while the session is still available — server-side only.
  const actor = await getCurrentActor();
  if (actor) {
    await recordAudit({
      hospitalId: cookieStore.get(ACTIVE_HOSPITAL_COOKIE)?.value ?? null,
      actorId: actor.id,
      action: AUDIT_ACTIONS.authLogout,
      entityType: "User",
      entityId: actor.id,
      summary: "Déconnexion",
    });
  }
  cookieStore.delete(ACTIVE_HOSPITAL_COOKIE);
  // Phase 6.4 (scope 1) — leaving the demo returns the reviewer to the PUBLIC site,
  // not to a login dead-end. The session is fully cleared either way; /connexion
  // stays one click away from /accueil.
  await signOut({ redirectTo: "/accueil" });
}

/** Set the active hospital (validated + audited in the service layer). */
export async function selectHospitalAction(hospitalId: string) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/connexion");

  await selectHospital(actor, hospitalId);
  (await cookies()).set(ACTIVE_HOSPITAL_COOKIE, hospitalId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}
