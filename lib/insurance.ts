/**
 * Phase 4E — pure helpers for the insurance / mutuelle foundation (no I/O, no server imports). Payer,
 * coverage-profile, and coverage-link validation, plus the MANUAL pre-authorization and claim-draft
 * state machines. Eligibility is a placeholder — never a real insurer check. No auto-submission.
 */

export type PreAuthStatusCode = "DRAFT" | "REQUESTED" | "APPROVED" | "REJECTED";
export type ClaimStatusCode = "DRAFT" | "SUBMITTED_PLACEHOLDER" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
export type EligibilityStatusCode = "UNKNOWN" | "ELIGIBLE_PLACEHOLDER" | "INELIGIBLE_PLACEHOLDER";

export const ELIGIBILITY_STATUSES: readonly EligibilityStatusCode[] = [
  "UNKNOWN",
  "ELIGIBLE_PLACEHOLDER",
  "INELIGIBLE_PLACEHOLDER",
];
export const CLAIM_STATUSES: readonly ClaimStatusCode[] = [
  "DRAFT",
  "SUBMITTED_PLACEHOLDER",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
];

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result = Ok | Err;

export function validatePayerInput(input: { code: string; name: string; kind: string }): Result {
  if (!CODE_RE.test(input.code?.trim() ?? "")) return { ok: false, error: "Le code du payeur doit être en MAJUSCULES (2 à 40 caractères)." };
  if (!input.name?.trim()) return { ok: false, error: "Le nom du payeur est obligatoire." };
  if (!input.kind?.trim()) return { ok: false, error: "Le type (MUTUELLE / ASSURANCE / STATE) est obligatoire." };
  return { ok: true };
}

export function validateCoverageProfileInput(input: { code: string; name: string; coveragePercent: number }): Result {
  if (!CODE_RE.test(input.code?.trim() ?? "")) return { ok: false, error: "Le code du profil doit être en MAJUSCULES (2 à 40 caractères)." };
  if (!input.name?.trim()) return { ok: false, error: "Le nom du profil est obligatoire." };
  if (!Number.isInteger(input.coveragePercent) || input.coveragePercent < 0 || input.coveragePercent > 100) {
    return { ok: false, error: "Le taux de couverture (placeholder) doit être un entier de 0 à 100." };
  }
  return { ok: true };
}

export function validateCoverageLinkInput(input: { memberNumber: string }): Result {
  if (!input.memberNumber?.trim()) return { ok: false, error: "Le numéro d'adhérent est obligatoire." };
  return { ok: true };
}

/** MANUAL pre-authorization state machine. */
const PREAUTH_TRANSITIONS: Record<PreAuthStatusCode, PreAuthStatusCode[]> = {
  DRAFT: ["REQUESTED"],
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};
export function canTransitionPreAuth(from: PreAuthStatusCode, to: PreAuthStatusCode): boolean {
  return PREAUTH_TRANSITIONS[from]?.includes(to) ?? false;
}

/** MANUAL claim-draft state machine — "SUBMITTED_PLACEHOLDER" is a manual status, NOT an insurer call. */
const CLAIM_TRANSITIONS: Record<ClaimStatusCode, ClaimStatusCode[]> = {
  DRAFT: ["SUBMITTED_PLACEHOLDER"],
  SUBMITTED_PLACEHOLDER: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
};
export function canTransitionClaim(from: ClaimStatusCode, to: ClaimStatusCode): boolean {
  return CLAIM_TRANSITIONS[from]?.includes(to) ?? false;
}
