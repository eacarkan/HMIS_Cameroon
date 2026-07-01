/**
 * Phase 4G — patient-matching (PURE, no I/O). Local, hospital-scoped, WARNING-ONLY duplicate-candidate
 * scoring built from explainable signals, plus pair canonicalization (A→B ≡ B→A), self-pair rejection,
 * and the manual review state machine. Nothing here merges, blocks, or decides identity — it produces
 * warnings a human reviewer weighs. Reuses the Phase 1A normalizers.
 */

import { normalizeName, normalizePhone } from "./patient-matching";

export type PatientMatchStatusCode =
  | "CANDIDATE"
  | "UNDER_REVIEW"
  | "MARKED_DUPLICATE"
  | "MARKED_NOT_DUPLICATE"
  | "NEEDS_MORE_INFORMATION"
  | "DISMISSED";

/** Warning signals — assistive only, never identity proof. */
export type MatchSignalType =
  | "name_exact"
  | "dob_exact"
  | "phone_match"
  | "guardian_phone_match"
  | "sex_match"
  | "estimated_age_range"
  | "temp_identifier_pattern";

export type FiredSignal = { type: MatchSignalType; weight: number };

/** Conservative weights — favour precision (avoid false-positive floods). A single weak signal never
 *  surfaces a candidate; the strong pair is name+DOB (90) or a phone pair (35+20). */
export const SIGNAL_WEIGHTS: Record<MatchSignalType, number> = {
  name_exact: 45,
  dob_exact: 45,
  phone_match: 35,
  guardian_phone_match: 20,
  sex_match: 5,
  estimated_age_range: 10,
  temp_identifier_pattern: 5,
};

/** A candidate is surfaced only at/above this score — requires at least two meaningful signals. */
export const MATCH_THRESHOLD = 50;

export const ACTIVE_MATCH_STATUSES: readonly PatientMatchStatusCode[] = ["CANDIDATE", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"];
export const TERMINAL_MATCH_STATUSES: readonly PatientMatchStatusCode[] = ["MARKED_DUPLICATE", "MARKED_NOT_DUPLICATE", "DISMISSED"];

/** The minimal patient shape the matcher compares (identity fields only). */
export type MatchablePatient = {
  id: string;
  familyName: string;
  givenName: string;
  dateOfBirth: Date | string;
  sex: string;
  phone: string | null;
  guardianPhone: string | null;
  estimatedAge: number | null;
  isEstimatedAge: boolean;
  isTemporaryIdentity: boolean;
};

/** Calendar day in UTC (the DOB column is a DATE), YYYY-MM-DD; "" if unparseable. */
function isoDay(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Deterministically ordered pair key so A→B and B→A resolve to ONE pair. */
export function canonicalPairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join("::");
}

/** A pair where source == candidate is invalid. */
export function isSelfPair(idA: string, idB: string): boolean {
  return idA === idB;
}

/** The explainable signals that fire between two patients (order stable, strongest first by weight). */
export function computeMatchSignals(a: MatchablePatient, b: MatchablePatient): FiredSignal[] {
  const signals: FiredSignal[] = [];
  const fam = normalizeName(a.familyName);
  const giv = normalizeName(a.givenName);
  if (fam && giv && fam === normalizeName(b.familyName) && giv === normalizeName(b.givenName)) {
    signals.push({ type: "name_exact", weight: SIGNAL_WEIGHTS.name_exact });
  }
  const dayA = isoDay(a.dateOfBirth);
  if (dayA && dayA === isoDay(b.dateOfBirth)) {
    signals.push({ type: "dob_exact", weight: SIGNAL_WEIGHTS.dob_exact });
  }
  const phoneA = normalizePhone(a.phone);
  if (phoneA && phoneA === normalizePhone(b.phone)) {
    signals.push({ type: "phone_match", weight: SIGNAL_WEIGHTS.phone_match });
  }
  const guardA = normalizePhone(a.guardianPhone);
  if (guardA && guardA === normalizePhone(b.guardianPhone)) {
    signals.push({ type: "guardian_phone_match", weight: SIGNAL_WEIGHTS.guardian_phone_match });
  }
  if (a.sex && a.sex === b.sex) {
    signals.push({ type: "sex_match", weight: SIGNAL_WEIGHTS.sex_match });
  }
  if (a.isEstimatedAge && b.isEstimatedAge && a.estimatedAge != null && b.estimatedAge != null && Math.abs(a.estimatedAge - b.estimatedAge) <= 1) {
    signals.push({ type: "estimated_age_range", weight: SIGNAL_WEIGHTS.estimated_age_range });
  }
  if (a.isTemporaryIdentity && b.isTemporaryIdentity) {
    signals.push({ type: "temp_identifier_pattern", weight: SIGNAL_WEIGHTS.temp_identifier_pattern });
  }
  return signals;
}

export type ScoredMatch = { score: number; signals: FiredSignal[] };

/** Score a pair (sum of fired signal weights). Warning-only — never an automatic action. */
export function scoreCandidate(a: MatchablePatient, b: MatchablePatient): ScoredMatch {
  const signals = computeMatchSignals(a, b);
  return { score: signals.reduce((s, x) => s + x.weight, 0), signals };
}

/** Whether a scored pair is strong enough to surface as a candidate. */
export function shouldSurfaceCandidate(score: number): boolean {
  return score >= MATCH_THRESHOLD;
}

/** Manual review state machine. `CANDIDATE → UNDER_REVIEW` starts review; every other forward move is a
 *  judgment. Terminal states (MARKED_DUPLICATE / MARKED_NOT_DUPLICATE / DISMISSED) do not transition. */
export function canTransitionMatchStatus(from: PatientMatchStatusCode, to: PatientMatchStatusCode): boolean {
  switch (from) {
    case "CANDIDATE":
      return to === "UNDER_REVIEW" || to === "DISMISSED";
    case "UNDER_REVIEW":
      return to === "MARKED_DUPLICATE" || to === "MARKED_NOT_DUPLICATE" || to === "NEEDS_MORE_INFORMATION" || to === "DISMISSED";
    case "NEEDS_MORE_INFORMATION":
      return to === "UNDER_REVIEW" || to === "MARKED_DUPLICATE" || to === "MARKED_NOT_DUPLICATE" || to === "DISMISSED";
    default:
      return false; // terminal
  }
}

/** A reason/comment is mandatory for every judgment (anything except simply starting the review). */
export function decisionRequiresReason(to: PatientMatchStatusCode): boolean {
  return to !== "UNDER_REVIEW";
}
