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

/** Numeric `NN` suffix of a temporary identifier sharing `dayPrefix`, or null if it doesn't match.
 *  Used to compute the next sequence as MAX(suffix)+1 (gap-tolerant, concurrency-safe — Phase 3F-5). */
export function parseTemporarySeq(identifier: string, dayPrefix: string): number | null {
  if (!identifier.startsWith(dayPrefix)) return null;
  const suffix = identifier.slice(dayPrefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  return Number(suffix);
}

/** Next sequence number for a day given the existing temporary identifiers: MAX(suffix)+1 (1 if none).
 *  MAX-based (not count-based) so a gap in the suffix sequence never reproduces a taken number. */
export function nextTemporarySeq(existingIdentifiers: readonly string[], dayPrefix: string): number {
  let max = 0;
  for (const id of existingIdentifiers) {
    const seq = parseTemporarySeq(id, dayPrefix);
    if (seq !== null && seq > max) max = seq;
  }
  return max + 1;
}

export type AgeInput = {
  /** ISO date string (or empty/undefined when unknown). */
  dateOfBirth?: string | null;
  /** Estimated age in years (when DOB is unknown). */
  estimatedAge?: number | null;
};

/**
 * Validate the age input: exactly ONE of DOB or estimated age must be provided (mutually
 * exclusive, mutually aware); an estimated age must be a sane integer; and (Phase 2 QA) when
 * a DOB is given it must PARSE, not be in the future, and not imply an impossible age (>130y).
 * Pass `now` (e.g. `new Date()` from the action) to enable the future/too-old checks. French
 * messages.
 */
export function validateAgeInput(
  input: AgeInput,
  now?: Date,
): { ok: boolean; error?: string } {
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
  if (hasDob) {
    const parsed = parseStrictDob((input.dateOfBirth as string).trim());
    if (!parsed) {
      return { ok: false, error: "La date de naissance doit être une date réelle au format AAAA-MM-JJ." };
    }
    if (now) {
      // Compare at CALENDAR-DAY granularity with a one-day tolerance: `parsed` is UTC-midnight and
      // `now` is an absolute instant, so an instant comparison would wrongly reject a DOB of "today"
      // when the local date is ahead of UTC (e.g. a newborn registered just after midnight in WAT,
      // UTC+1). The +1-day grace covers any UTC+ timezone; a DOB beyond tomorrow-UTC is still future.
      const nowUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      if (parsed.getTime() > nowUtcMidnight + 24 * 60 * 60 * 1000) {
        return { ok: false, error: "La date de naissance ne peut pas être dans le futur." };
      }
      if (ageInYearsUtc(parsed, now) > MAX_ESTIMATED_AGE) {
        return {
          ok: false,
          error: "La date de naissance implique un âge invalide (supérieur à 130 ans).",
        };
      }
    }
  }
  return { ok: true };
}

/** Strict `YYYY-MM-DD` calendar date → UTC Date, or null. Rejects loose strings (e.g. "2020",
 *  "01/02/2020", "Jan 2020") and impossible dates (e.g. "2020-02-30"); round-trip-checked so
 *  no silent normalisation slips through. Phase 3F-5 identity hardening. */
export function parseStrictDob(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

/** Whole years between a UTC DOB and `now` (timezone-stable; used for the >130y guard). */
function ageInYearsUtc(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}
