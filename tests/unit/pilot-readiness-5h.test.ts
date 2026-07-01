import { describe, expect, it } from "vitest";

import { GATE7_DISCLAIMER_EN, GATE7_DISCLAIMER_FR, computeGate7Signal, summarizeUat } from "@/lib/uat-gate7";

/**
 * Phase 5H — pilot-readiness evidence is NEVER an authorization. Even when all UAT scenarios pass and
 * every readiness criterion is "ready", the software's signal stays `authorized: false` — Gate 7 is an
 * administrative, co-signed decision. The disclaimer says so explicitly (Fr + En).
 */
describe("unit: Phase 5H pilot-readiness is evidence, not authorization", () => {
  it("the readiness signal is NEVER self-authorized, even with complete evidence", () => {
    const uat = summarizeUat(["pass", "pass", "pass"]);
    const signal = computeGate7Signal(uat, ["ready", "ready"]);
    expect(signal.evidenceComplete).toBe(true); // evidence assembled…
    expect(signal.authorized).toBe(false); // …but software never authorizes Gate 7
  });

  it("a blocker keeps evidence incomplete and still unauthorized", () => {
    const uat = summarizeUat(["pass", "blocker"]);
    const signal = computeGate7Signal(uat, ["ready"]);
    expect(signal.evidenceComplete).toBe(false);
    expect(signal.authorized).toBe(false);
  });

  it("the disclaimer states readiness evidence only — not an authorization (Fr + En)", () => {
    expect(GATE7_DISCLAIMER_FR).toMatch(/ne constitue pas une autorisation/i);
    expect(GATE7_DISCLAIMER_EN).toMatch(/not an authorization/i);
  });
});
