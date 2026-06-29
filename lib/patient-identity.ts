/**
 * Patient identity helpers (pure, client-safe) — Phase 2B.
 *
 * Estimated-age ↔ approximate-birth-year derivation, temporary/unidentified-patient
 * identifier formatting (`Inconnu_YYMMDD_NN`), and registration validation (DOB vs.
 * estimated-age exclusivity, optional phone). No data access, no side effects (09 §6:
 * `lib/` must not import `@/server`). Unit-tested.
 */

export const MAX_ESTIMATED_AGE = 130;

/** Approximate birth year from an estimated age relative to a reference year. */
export function approxBirthYear(estimatedAge: number, currentYear: number): number {
  return currentYear - estimatedAge;
}

/** Estimated date of birth: 1 January (UTC) of the approximate birth year. */
export function estimatedBirthDate(estimatedAge: number, currentYear: number): Date {
  return new Date(Date.UTC(approxBirthYear(estimatedAge, currentYear), 0, 1));
}

function yymmdd(date: Date): string {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** The per-day prefix `Inconnu_YYMMDD_` used to count/sequence temporary patients. */
export function temporaryIdDayPrefix(date: Date): string {
  return `Inconnu_${yymmdd(date)}_`;
}

/** Temporary/unidentified-patient identifier `Inconnu_YYMMDD_NN` (per hospital + day). */
export function temporaryIdentifierFor(date: Date, seq: number): string {
  return `${temporaryIdDayPrefix(date)}${String(seq).padStart(2, "0")}`;
}

export type AgeInput = {
  /** ISO date string (or empty/undefined when unknown). */
  dateOfBirth?: string | null;
  /** Estimated age in years (when DOB is unknown). */
  estimatedAge?: number | null;
};

/**
 * Validate the age input: exactly ONE of DOB or estimated age must be provided (mutually
 * exclusive, mutually aware), and an estimated age must be a sane integer. French messages.
 */
export function validateAgeInput(input: AgeInput): { ok: boolean; error?: string } {
  const hasDob = Boolean(input.dateOfBirth && input.dateOfBirth.trim());
  const hasEstimate = input.estimatedAge !== null && input.estimatedAge !== undefined;
  if (hasDob && hasEstimate) {
    return {
      ok: false,
      error: "Indiquez soit la date de naissance, soit l'âge estimé — pas les deux.",
    };
  }
  if (!hasDob && !hasEstimate) {
    return { ok: false, error: "La date de naissance ou l'âge estimé est obligatoire." };
  }
  if (hasEstimate) {
    const age = input.estimatedAge as number;
    if (!Number.isInteger(age) || age < 0 || age > MAX_ESTIMATED_AGE) {
      return { ok: false, error: "L'âge estimé doit être un entier entre 0 et 130." };
    }
  }
  return { ok: true };
}
