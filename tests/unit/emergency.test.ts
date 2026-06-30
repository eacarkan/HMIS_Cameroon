import { describe, expect, it } from "vitest";

import {
  canDecideEmergencyDebt,
  hasOutstandingEmergencyDebt,
  sumOutstandingEmergencyDebt,
  validateEmergencyDebtInput,
} from "@/lib/emergency";

describe("emergency rules (Phase 2H)", () => {
  it("validates a positive integer amount + a mandatory source", () => {
    expect(validateEmergencyDebtInput({ amount: 3000, source: "Soins" }).ok).toBe(true);
    expect(validateEmergencyDebtInput({ amount: 0, source: "x" }).ok).toBe(false);
    expect(validateEmergencyDebtInput({ amount: -10, source: "x" }).ok).toBe(false);
    expect(validateEmergencyDebtInput({ amount: 2.5, source: "x" }).ok).toBe(false);
    expect(validateEmergencyDebtInput({ amount: 100, source: "  " }).ok).toBe(false);
  });

  it("only an outstanding entry can be decided", () => {
    expect(canDecideEmergencyDebt("outstanding")).toBe(true);
    expect(canDecideEmergencyDebt("settled")).toBe(false);
    expect(canDecideEmergencyDebt("waived")).toBe(false);
  });

  it("sums only outstanding amounts and detects any outstanding", () => {
    const debts = [
      { amount: 3000, status: "outstanding" },
      { amount: 2000, status: "settled" },
      { amount: 1500, status: "outstanding" },
      { amount: 500, status: "waived" },
    ];
    expect(sumOutstandingEmergencyDebt(debts)).toBe(4500); // 3000 + 1500
    expect(hasOutstandingEmergencyDebt(debts)).toBe(true);
    expect(hasOutstandingEmergencyDebt([{ status: "settled" }, { status: "waived" }])).toBe(false);
  });
});
