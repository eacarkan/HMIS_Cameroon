/**
 * Environment validation (pure, client-safe) — Phase 1A Batch 6.
 *
 * Checks that the required configuration is present. Used by the status page to surface
 * misconfiguration and to "fail closed" (an invalid environment is reported, not hidden).
 * No data access; takes the env as an argument so it is deterministically testable.
 */
export type EnvValidation = { ok: boolean; missing: string[] };

/** Variables the app cannot run safely without. */
export const REQUIRED_ENV = ["DATABASE_URL", "AUTH_SECRET"] as const;

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvValidation {
  const missing = REQUIRED_ENV.filter((key) => {
    const value = env[key];
    return !value || value.trim().length === 0;
  });
  return { ok: missing.length === 0, missing };
}
