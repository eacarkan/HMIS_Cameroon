/**
 * Password policy (pure, client-safe) — Phase 1A Batch 4.
 *
 * Baseline demo policy: minimum length + at least one lower-case, one upper-case and one
 * digit. Explicit and tested. This is a prototype policy on fake/demo data — it is NOT a
 * production credential policy (no breach lists, rotation, history, MFA, or SSO).
 */
export const PASSWORD_MIN_LENGTH = 8;

export type PasswordCheck = { ok: boolean; errors: string[] };

export function validatePassword(password: string): PasswordCheck {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Le mot de passe doit comporter au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  }
  if (!/[a-z]/.test(password)) errors.push("Le mot de passe doit contenir une minuscule.");
  if (!/[A-Z]/.test(password)) errors.push("Le mot de passe doit contenir une majuscule.");
  if (!/[0-9]/.test(password)) errors.push("Le mot de passe doit contenir un chiffre.");
  return { ok: errors.length === 0, errors };
}
