import { describe, expect, it } from "vitest";

import {
  type MatchablePatient,
  canTransitionMatchStatus,
  canonicalPairKey,
  decisionRequiresReason,
  isSelfPair,
  scoreCandidate,
  shouldSurfaceCandidate,
} from "@/lib/patient-match";

/**
 * Phase 4G — pure patient-matching helpers: pair canonicalization (A→B ≡ B→A), self-pair rejection,
 * explainable scoring, the conservative threshold, and the manual review state machine. No I/O.
 */
function patient(over: Partial<MatchablePatient>): MatchablePatient {
  return {
    id: "p", familyName: "Mballa", givenName: "Jean", dateOfBirth: new Date("1990-01-01"), sex: "male",
    phone: null, guardianPhone: null, estimatedAge: null, isEstimatedAge: false, isTemporaryIdentity: false,
    ...over,
  };
}

describe("unit: Phase 4G patient-matching helpers", () => {
  it("canonicalPairKey makes A→B and B→A the SAME pair", () => {
    expect(canonicalPairKey("a", "b")).toBe(canonicalPairKey("b", "a"));
    expect(canonicalPairKey("z9", "a1")).toBe("a1::z9");
  });

  it("isSelfPair rejects source == candidate", () => {
    expect(isSelfPair("x", "x")).toBe(true);
    expect(isSelfPair("x", "y")).toBe(false);
  });

  it("scoreCandidate is explainable and conservative (favours precision)", () => {
    const a = patient({ id: "a", phone: "699112233" });
    // Same name + DOB → strong (name_exact 45 + dob_exact 45 + sex 5 = 95).
    const nameDob = scoreCandidate(a, patient({ id: "b", phone: "677000000" }));
    expect(nameDob.score).toBe(95);
    expect(nameDob.signals.map((s) => s.type)).toEqual(expect.arrayContaining(["name_exact", "dob_exact", "sex_match"]));
    expect(shouldSurfaceCandidate(nameDob.score)).toBe(true);

    // Phone alone (different name + DOB) = 35 → BELOW threshold (a single weak-ish signal never surfaces).
    const phoneOnly = scoreCandidate(
      patient({ id: "a", familyName: "Mballa", givenName: "Jean", dateOfBirth: new Date("1990-01-01"), sex: "male", phone: "699112233" }),
      patient({ id: "b", familyName: "Ngono", givenName: "Paul", dateOfBirth: new Date("1975-05-05"), sex: "female", phone: "699112233" }),
    );
    expect(phoneOnly.score).toBe(35);
    expect(shouldSurfaceCandidate(phoneOnly.score)).toBe(false);

    // No shared signal → 0.
    expect(scoreCandidate(
      patient({ id: "a", familyName: "Aaa", givenName: "Bbb", dateOfBirth: new Date("1990-01-01"), sex: "male" }),
      patient({ id: "b", familyName: "Ccc", givenName: "Ddd", dateOfBirth: new Date("1980-02-02"), sex: "female" }),
    ).score).toBe(0);
  });

  it("the review state machine requires a review before a decision, and terminals are terminal", () => {
    expect(canTransitionMatchStatus("CANDIDATE", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionMatchStatus("CANDIDATE", "MARKED_DUPLICATE")).toBe(false); // must review first
    expect(canTransitionMatchStatus("UNDER_REVIEW", "MARKED_DUPLICATE")).toBe(true);
    expect(canTransitionMatchStatus("UNDER_REVIEW", "NEEDS_MORE_INFORMATION")).toBe(true);
    expect(canTransitionMatchStatus("NEEDS_MORE_INFORMATION", "MARKED_NOT_DUPLICATE")).toBe(true);
    expect(canTransitionMatchStatus("MARKED_DUPLICATE", "UNDER_REVIEW")).toBe(false); // terminal
    expect(canTransitionMatchStatus("DISMISSED", "CANDIDATE")).toBe(false); // terminal
  });

  it("a reason is mandatory for every judgment (but not for merely starting review)", () => {
    expect(decisionRequiresReason("UNDER_REVIEW")).toBe(false);
    expect(decisionRequiresReason("MARKED_DUPLICATE")).toBe(true);
    expect(decisionRequiresReason("MARKED_NOT_DUPLICATE")).toBe(true);
    expect(decisionRequiresReason("NEEDS_MORE_INFORMATION")).toBe(true);
    expect(decisionRequiresReason("DISMISSED")).toBe(true);
  });
});
