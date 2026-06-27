"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "./config";

/**
 * Auth transport actions (09 §4). Thin: they call Auth.js sign-in/out. Credential
 * verification + audit live in the service layer (auth-service).
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
  await signOut({ redirectTo: "/connexion" });
}
