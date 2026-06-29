/**
 * Patient duplicate-matching (pure, client-safe) — Phase 1A Batch 1A.
 *
 * Conservative, deterministic, WARNING-ONLY duplicate detection used at registration.
 * It never decides identity, never merges, never blocks: it only labels likely-duplicate
 * existing patients so the user can choose to continue or cancel. Thresholds are explicit
 * here and unit-tested. No data access, no side effects (09 §6 layering: pure lib).
 */

/** Why a candidate was flagged. `name_dob` is the strong signal; `phone` is secondary. */
export type DuplicateMatchBasis = "name_dob" | "phone";

/** Minimal shape needed to compare an existing patient against new registration input. */
export type DuplicateComparable = {
  id: string;
  familyName: string;
  givenName: string;
  dateOfBirth: Date | string;
  phone: string | null;
};

export type DuplicateInput = {
  familyName: string;
  givenName: string;
  dateOfBirth: Date | string;
  phone: string | null;
};

export type DuplicateMatch<T extends DuplicateComparable = DuplicateComparable> = {
  patient: T;
  basis: DuplicateMatchBasis;
};

/** Lower-case, strip diacritics, collapse internal whitespace, trim. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep digits only (drops spaces, "+", separators). Empty string if no digits. */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Calendar day in UTC (the column is a DATE), as YYYY-MM-DD, for exact DOB comparison. */
function isoDay(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Strong rule: same family name AND same given name (normalized) AND identical date of
 * birth. Exact-by-design to avoid false positives — fuzzy matching is intentionally NOT
 * used in Phase 1A.
 */
export function matchesNameDob(input: DuplicateInput, candidate: DuplicateComparable): boolean {
  const family = normalizeName(input.familyName);
  const given = normalizeName(input.givenName);
  if (!family || !given) return false;
  const day = isoDay(input.dateOfBirth);
  if (!day) return false;
  return (
    family === normalizeName(candidate.familyName) &&
    given === normalizeName(candidate.givenName) &&
    day === isoDay(candidate.dateOfBirth)
  );
}

/** Secondary rule: identical phone number (digits only), only when a phone is provided. */
export function matchesPhone(input: DuplicateInput, candidate: DuplicateComparable): boolean {
  const phone = normalizePhone(input.phone);
  if (phone.length === 0) return false;
  return phone === normalizePhone(candidate.phone);
}

/**
 * Classify existing patients as likely duplicates of the registration input. `name_dob`
 * takes precedence over `phone`. Each candidate appears at most once. The result is a
 * WARNING only — the caller surfaces it and lets the user continue or cancel.
 */
export function classifyDuplicates<T extends DuplicateComparable>(
  input: DuplicateInput,
  candidates: readonly T[],
): DuplicateMatch<T>[] {
  const matches: DuplicateMatch<T>[] = [];
  for (const candidate of candidates) {
    if (matchesNameDob(input, candidate)) {
      matches.push({ patient: candidate, basis: "name_dob" });
    } else if (matchesPhone(input, candidate)) {
      matches.push({ patient: candidate, basis: "phone" });
    }
  }
  return matches;
}
