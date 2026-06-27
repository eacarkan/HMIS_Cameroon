import bcrypt from "bcryptjs";

import { findUserByEmailWithRoles } from "@/server/db";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Auth service (09 §3, §7). Owns the authentication use-case: verify credentials
 * against the stored bcrypt hash, derive the actor (roles + hospital context), and
 * write the `auth.login` audit entry. Auth.js handles the session; business
 * authorization (Step 5+) stays in the service layer, never the UI.
 */

/** The authenticated current actor, carried in the session and used server-side. */
export type AuthenticatedActor = {
  id: string;
  displayName: string;
  email: string;
  /** Role codes (e.g. "caissier"). */
  roles: string[];
  /** Active hospital context — for now the user's (single) assigned hospital. */
  hospitalId: string | null;
  hospitalCode: string | null;
  hospitalName: string | null;
};

/**
 * Verify email + password. Returns the actor on success (and logs `auth.login`),
 * or null on any failure — without leaking which part failed.
 */
export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedActor | null> {
  const user = await findUserByEmailWithRoles(email);
  if (!user || user.status !== "active") return null;

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) return null;

  const roles = user.userRoles.map((ur) => ur.role.code);
  // Single active hospital in the prototype; the real selector arrives at Step 5.
  const primary = user.userRoles[0];
  const hospitalId = primary?.hospitalId ?? null;
  const hospitalCode = primary?.hospital.code ?? null;
  const hospitalName = primary?.hospital.name ?? null;

  await recordAudit({
    hospitalId,
    actorId: user.id,
    action: AUDIT_ACTIONS.authLogin,
    entityType: "User",
    entityId: user.id,
    summary: `Connexion de ${user.displayName}`,
  });

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    roles,
    hospitalId,
    hospitalCode,
    hospitalName,
  };
}
