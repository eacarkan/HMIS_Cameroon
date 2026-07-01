"use server";

import { AuthError } from "next-auth";

import { getDemoSharedPassword } from "@/lib/demo-password";
import { canStartOneClickDemo } from "@/lib/deployment-mode";
import { resolveOneClickDemoRole } from "@/lib/demo-access";
import { recordDemoSessionRequest } from "@/server/services";
import { signIn } from "./config";

/**
 * One-click demo login (Phase 6C; password + audit corrected in 6.1). Starts a SYNTHETIC
 * demo session for one of the SELECTED roles — but only when `canStartOneClickDemo()` holds
 * (stakeholder-demo mode AND `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true`). Fails closed everywhere
 * else (a no-op), so a forged POST outside the stakeholder-demo deployment can never start a
 * session.
 *
 * Security:
 *   - server-side flag gate (independent of whether the buttons were rendered);
 *   - role key resolved against a server-side allow-list (sensitive roles refused);
 *   - the password is NOT committed and NOT taken from the client — it comes from
 *     `HMIS_DEMO_SHARED_PASSWORD` server-side (fail closed if unset), and the sign-in still
 *     goes through `authenticateCredentials`, so the F-02 account lockout is fully preserved;
 *   - a `demo.session_requested` audit is written after the pre-checks pass (an accurate
 *     "requested" event); the confirmed successful session is recorded by `auth.login`.
 */
export async function demoLoginAction(roleKey: string): Promise<void> {
  // Fail closed: one-click is refused outside stakeholder-demo mode or with the flag off.
  if (!canStartOneClickDemo()) return;

  const role = resolveOneClickDemoRole(roleKey);
  if (!role) return;

  // Env-controlled synthetic demo password (server-side only). If it is not configured,
  // one-click is a no-op — never a committed default.
  let password: string;
  try {
    password = getDemoSharedPassword();
  } catch {
    return;
  }

  // Record the one-click demo login REQUEST (pre-checks passed; synthetic account, server-side).
  await recordDemoSessionRequest(role.email);

  try {
    await signIn("credentials", {
      email: role.email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    // Auth.js throws a redirect on success — that must propagate. A genuine failure
    // (e.g. the synthetic account is currently locked by F-02) is a silent no-op.
    if (error instanceof AuthError) return;
    throw error;
  }
}
