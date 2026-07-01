/**
 * Shared synthetic demo password — env-controlled (Phase 6.1).
 *
 * The synthetic demo password is NOT committed. It is provided at runtime via the
 * server-side env var `HMIS_DEMO_SHARED_PASSWORD` and used for:
 *   - seeding the synthetic demo users (`prisma/seed-data`), and
 *   - server-side one-click demo login (`server/auth/demo-actions`).
 *
 * Fails closed: throws a clear operator/developer error if the value is missing where it
 * is required. Tests inject a deterministic value through their setup.
 *
 * SECURITY: never import this from a client component. `HMIS_DEMO_SHARED_PASSWORD` has no
 * `NEXT_PUBLIC_` prefix, so Next.js never inlines it into the client bundle; the public
 * demo-access page instead displays the optional `NEXT_PUBLIC_DEMO_PASSWORD_HINT`.
 */
export function getDemoSharedPassword(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env["HMIS_DEMO_SHARED_PASSWORD"];
  if (!value || value.trim().length === 0) {
    throw new Error(
      "HMIS_DEMO_SHARED_PASSWORD is not set. Provide the synthetic demo password via the " +
        "deployment/seed environment (a Vercel env var, or your local .env / test setup) — " +
        "never commit a password.",
    );
  }
  return value;
}
