/**
 * Account-security policy (pure, client-safe) — Phase 1A Batch 4.
 *
 * Lockout thresholds and role-assignment safeguards. Pure + tested so the policy is ready;
 * enforcement of *automatic* failed-attempt lockout requires persistent counters (proposed
 * additive `User.failedLoginCount` / `lockedUntil` columns — a reviewed migration, NOT
 * created here). Today, locking is enforced via the existing account status (a disabled
 * account is rejected at authentication). No SSO, no production secrets management.
 */

/** Maximum consecutive failed sign-ins before an account should be locked. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Idle session lifetime (seconds) — wired into the Auth.js JWT session. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export function isLockedOut(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function attemptsRemaining(failedAttempts: number): number {
  return Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
}

/** The coarse Phase 1 roles an administrator may assign (least privilege; no unknown roles). */
export const ASSIGNABLE_ROLE_CODES = [
  "administrateur",
  "agent_accueil",
  "medecin",
  "caissier",
  "directeur",
] as const;

export type AssignableRoleCode = (typeof ASSIGNABLE_ROLE_CODES)[number];

/** Guard against assigning an unknown / over-privileged role code. */
export function canAssignRole(roleCode: string): roleCode is AssignableRoleCode {
  return (ASSIGNABLE_ROLE_CODES as readonly string[]).includes(roleCode);
}
