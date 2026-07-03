/**
 * Pure safety helpers for the synthetic demo seed (Phase 6.3 S1A). No imports, no side effects,
 * no I/O — so they are unit-testable and importable by `scripts/seed-demo.ts` without pulling in
 * the database. These enforce the mentor's safety conditions:
 *  - synthetic patient contacts can never look like real, reachable phone numbers;
 *  - the destructive `--force` flag is refused unless `--test` is also present.
 */

/** Prefix for the clearly-synthetic contact placeholder written to demo patients. */
export const SYNTHETIC_CONTACT_PREFIX = "DEMO-CONTACT-";

/**
 * A clearly-artificial contact value for a synthetic demo patient. NOT a phone number — it is a
 * visibly fake token (e.g. `DEMO-CONTACT-000001`) that cannot be dialled or mistaken for a real
 * person's contact.
 */
export function syntheticContact(index: number): string {
  return `${SYNTHETIC_CONTACT_PREFIX}${String(index + 1).padStart(6, "0")}`;
}

/**
 * True when a value could be mistaken for a real (reachable) phone number — used to keep
 * plausible Cameroon numbers (`+237 6…`, `+237 2…`, local `6xxxxxxxx` / `2xxxxxxxx`) out of the
 * synthetic seed. Any all-digit run of 8+ (optionally `+`-prefixed) is also treated as risky.
 */
export function looksLikeRealPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/[\s().\-]/g, "");
  if (/[A-Za-z]/.test(digits)) return false; // contains letters → not a phone (e.g. DEMO-CONTACT-…)
  return (
    /^\+?237[26]\d{6,}$/.test(digits) || // +237 6… / +237 2…
    /^[26]\d{8}$/.test(digits) || // local 6xxxxxxxx / 2xxxxxxxx
    /^\+?\d{8,}$/.test(digits) // any long numeric run
  );
}

/**
 * Refuse `--force` unless `--test` is also set. Returns the error message to print (and exit
 * non-zero on) when the combination is unsafe, or `null` when the flags are allowed. `--force`
 * bypasses the idempotency sentinel and would duplicate demo data, so it must never touch the
 * default (Neon / DATABASE_URL) target.
 */
export function forceGuardError(force: boolean, useTest: boolean): string | null {
  if (force && !useTest) {
    return "--force is only allowed with --test. Refusing to duplicate demo data on DATABASE_URL.";
  }
  return null;
}
