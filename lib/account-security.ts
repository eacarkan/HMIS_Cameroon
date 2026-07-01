/**
 * Account-security policy (pure, client-safe) — Phase 1A Batch 4, extended in Phase 5.1 (F-02).
 *
 * Lockout thresholds and role-assignment safeguards. Since Phase 5.1 the failed-attempt lockout is
 * PERSISTED (additive `User.failedLoginCount` / `lastFailedLoginAt` / `lockedUntil` columns) and enforced
 * in the credentials authorize path (`auth-service`): N consecutive failures lock the account until
 * `lockedUntil`; a successful sign-in resets the counter. A disabled account is still rejected. This is
 * app-level protection only — it complements (does not replace) edge rate-limiting. No SSO, no production
 * secrets management. The logic here is pure so it is fully unit-testable.
 */

/** Maximum consecutive failed sign-ins before an account is locked. */
export const MAX_FAILED_ATTEMPTS = 5;

/** How long an account stays locked after the threshold is reached (minutes). */
export const LOCKOUT_DURATION_MINUTES = 15;

/** Idle session lifetime (seconds) — wired into the Auth.js JWT session. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export function isLockedOut(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function attemptsRemaining(failedAttempts: number): number {
  return Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
}

/** Is the account currently locked (a future `lockedUntil`)? An expired lock is NOT locked. */
export function isCurrentlyLocked(lockedUntil: Date | null | undefined, now: Date): boolean {
  return lockedUntil != null && lockedUntil.getTime() > now.getTime();
}

/** The `lockedUntil` instant for a lock starting `now`. */
export function lockoutUntil(now: Date): Date {
  return new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
}

/**
 * Pure next-state after a FAILED sign-in for a known active user. If a prior lock has EXPIRED, the
 * counter restarts from zero; otherwise it increments. Reaching the threshold sets a fresh `lockedUntil`.
 */
export function nextFailedLoginState(
  current: { failedLoginCount: number; lockedUntil: Date | null | undefined },
  now: Date,
): { failedLoginCount: number; lockedUntil: Date | null } {
  const expired = current.lockedUntil != null && current.lockedUntil.getTime() <= now.getTime();
  const base = expired ? 0 : current.failedLoginCount;
  const failedLoginCount = base + 1;
  return { failedLoginCount, lockedUntil: failedLoginCount >= MAX_FAILED_ATTEMPTS ? lockoutUntil(now) : null };
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
