import { describe, expect, it } from "vitest";

import {
  canTransitionClaim,
  canTransitionPreAuth,
  validateCoverageLinkInput,
  validateCoverageProfileInput,
  validatePayerInput,
} from "@/lib/insurance";

/**
 * Phase 4E — pure insurance helpers. Payer / coverage-profile / coverage-link validation and the MANUAL
 * pre-auth + claim-draft state machines (no auto-submission). No I/O.
 */
describe("unit: Phase 4E insurance helpers", () => {
  it("validatePayerInput requires an UPPER code + name + kind", () => {
    expect(validatePayerInput({ code: "CNPS", name: "CNPS", kind: "STATE" }).ok).toBe(true);
    expect(validatePayerInput({ code: "lower", name: "x", kind: "k" }).ok).toBe(false);
    expect(validatePayerInput({ code: "OK", name: "", kind: "k" }).ok).toBe(false);
  });

  it("validateCoverageProfileInput requires a code/name + a 0..100 percent", () => {
    expect(validateCoverageProfileInput({ code: "STD", name: "Standard", coveragePercent: 80 }).ok).toBe(true);
    expect(validateCoverageProfileInput({ code: "STD", name: "Standard", coveragePercent: 120 }).ok).toBe(false);
    expect(validateCoverageProfileInput({ code: "STD", name: "Standard", coveragePercent: -1 }).ok).toBe(false);
  });

  it("validateCoverageLinkInput requires a member number", () => {
    expect(validateCoverageLinkInput({ memberNumber: "M-1" }).ok).toBe(true);
    expect(validateCoverageLinkInput({ memberNumber: "" }).ok).toBe(false);
  });

  it("the claim state machine allows only the manual forward path", () => {
    expect(canTransitionClaim("DRAFT", "SUBMITTED_PLACEHOLDER")).toBe(true);
    expect(canTransitionClaim("SUBMITTED_PLACEHOLDER", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionClaim("UNDER_REVIEW", "ACCEPTED")).toBe(true);
    expect(canTransitionClaim("UNDER_REVIEW", "REJECTED")).toBe(true);
    expect(canTransitionClaim("DRAFT", "ACCEPTED")).toBe(false); // no skipping
    expect(canTransitionClaim("ACCEPTED", "DRAFT")).toBe(false); // terminal
  });

  it("the pre-auth state machine: REQUESTED → APPROVED/REJECTED only", () => {
    expect(canTransitionPreAuth("REQUESTED", "APPROVED")).toBe(true);
    expect(canTransitionPreAuth("REQUESTED", "REJECTED")).toBe(true);
    expect(canTransitionPreAuth("APPROVED", "REJECTED")).toBe(false);
  });
});
