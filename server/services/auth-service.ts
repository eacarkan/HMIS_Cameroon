import bcrypt from "bcryptjs";

import { isCurrentlyLocked, nextFailedLoginState } from "@/lib/account-security";
import { validatePassword } from "@/lib/password-policy";
import {
  findUserByEmailWithRoles,
  findUserByIdWithRoles,
  recordFailedLogin,
  recordSuccessfulLogin,
  updateUserPassword,
} from "@/server/db";
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
  /**
   * Role codes the actor holds across ALL hospitals (de-duplicated union). Use ONLY for
   * coarse, non-authoritative UI/nav hints. NEVER for an authorization decision — that must
   * use the roles held AT the active hospital (`rolesByHospital`), enforced by requireCapability.
   */
  roles: string[];
  /**
   * Role codes the actor holds PER hospital (keyed by hospitalId). The AUTHORITATIVE source for
   * capability decisions: an actor may act in a hospital only with the roles granted THERE — never
   * borrowing a role's privilege from another hospital (cross-hospital privilege escalation).
   */
  rolesByHospital: Record<string, string[]>;
  /** All hospital ids the actor has access to (via UserRole). */
  hospitalIds: string[];
  /** Default/primary hospital (the user's first assignment). */
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
  // Unknown OR disabled account → generic null, and NO record is created (no user enumeration). A
  // disabled account is rejected exactly as before.
  if (!user || user.status !== "active") return null;

  const now = new Date();
  const primaryHospitalId = user.userRoles[0]?.hospitalId ?? null;

  // Phase 5.1 (F-02) — a currently-locked account is denied even with the CORRECT password (no password
  // check, no enumeration hint beyond the generic null). The lock-hit is audited (known user only).
  if (isCurrentlyLocked(user.lockedUntil, now)) {
    await recordAudit({
      hospitalId: primaryHospitalId, actorId: user.id, action: AUDIT_ACTIONS.authAccountLocked,
      entityType: "User", entityId: user.id, summary: "Tentative de connexion sur un compte verrouillé",
    });
    return null;
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    // Persist the failure; lock the account if the threshold is reached (a stale expired lock restarts
    // the counter). Audit the failure (and the lock event if it just locked). Generic null to the caller.
    const next = nextFailedLoginState({ failedLoginCount: user.failedLoginCount, lockedUntil: user.lockedUntil }, now);
    await recordFailedLogin(user.id, { failedLoginCount: next.failedLoginCount, lastFailedLoginAt: now, lockedUntil: next.lockedUntil });
    await recordAudit({
      hospitalId: primaryHospitalId, actorId: user.id, action: AUDIT_ACTIONS.authLoginFailed,
      entityType: "User", entityId: user.id, summary: `Échec de connexion (tentative ${next.failedLoginCount})`,
    });
    if (next.lockedUntil) {
      await recordAudit({
        hospitalId: primaryHospitalId, actorId: user.id, action: AUDIT_ACTIONS.authAccountLocked,
        entityType: "User", entityId: user.id, summary: "Compte verrouillé après échecs répétés",
      });
    }
    return null;
  }

  // Success → reset the lockout state and stamp the last successful sign-in.
  await recordSuccessfulLogin(user.id, now);

  const roles = [...new Set(user.userRoles.map((ur) => ur.role.code))];
  const hospitalIds = [...new Set(user.userRoles.map((ur) => ur.hospitalId))];
  // Bind each role to the hospital that granted it — the authoritative per-hospital role set.
  const rolesByHospital: Record<string, string[]> = {};
  for (const ur of user.userRoles) {
    const list = rolesByHospital[ur.hospitalId] ?? (rolesByHospital[ur.hospitalId] = []);
    if (!list.includes(ur.role.code)) list.push(ur.role.code);
  }
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
    rolesByHospital,
    hospitalIds,
    hospitalId,
    hospitalCode,
    hospitalName,
  };
}

/**
 * Change the current actor's own password (Phase 1A Batch 4): verify the current password,
 * enforce the password policy, store a fresh bcrypt hash, and audit `auth.password_change`.
 * No reset tokens, no secrets logged.
 */
export async function changeOwnPassword(
  actor: AuthenticatedActor,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await findUserByIdWithRoles(actor.id);
  if (!user) throw new Error("Utilisateur introuvable.");

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) throw new Error("Le mot de passe actuel est incorrect.");

  const check = validatePassword(newPassword);
  if (!check.ok) throw new Error(check.errors[0]);

  await updateUserPassword(actor.id, bcrypt.hashSync(newPassword, 10));
  await recordAudit({
    hospitalId: actor.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.authPasswordChange,
    entityType: "User",
    entityId: actor.id,
    summary: `Changement de mot de passe — ${user.displayName}`,
  });
}
