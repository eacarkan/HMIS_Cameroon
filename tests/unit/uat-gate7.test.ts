import { describe, expect, it } from "vitest";

import {
  CRITICAL_BLOCKER_CLASSES,
  GATE7_CRITERIA,
  GATE7_DISCLAIMER_EN,
  GATE7_DISCLAIMER_FR,
  UAT_SCENARIO_LIBRARY,
  computeGate7Signal,
  summarizeUat,
} from "@/lib/uat-gate7";

/**
 * Phase 3E — UAT/Gate 7 pure helpers. The load-bearing guarantee: the readiness signal is NEVER an
 * authorization, and the disclaimer says so.
 */

describe("summarizeUat", () => {
  it("counts pass/fail/blocker and percent over RUN scenarios", () => {
    const r = summarizeUat(["pass", "pass", "fail", "blocker", "not_run"]);
    expect(r.total).toBe(5);
    expect(r.run).toBe(4);
    expect(r.pass).toBe(2);
    expect(r.fail).toBe(1);
    expect(r.blocker).toBe(1);
    expect(r.percentPass).toBe(50); // 2/4
    expect(r.hasBlocker).toBe(true);
  });
});

describe("computeGate7Signal", () => {
  it("is NEVER an authorization (authorized is always false)", () => {
    const allPass = summarizeUat(Array(14).fill("pass"));
    const signal = computeGate7Signal(allPass, Array(GATE7_CRITERIA.length).fill("ready"));
    expect(signal.authorized).toBe(false);
    expect(signal.evidenceComplete).toBe(true); // evidence assembled — but still NOT authorized
  });

  it("evidence is incomplete with any blocker, fail, unrun scenario, or unready criterion", () => {
    const withBlocker = summarizeUat(["blocker", ...Array(13).fill("pass")]);
    expect(computeGate7Signal(withBlocker, Array(GATE7_CRITERIA.length).fill("ready")).evidenceComplete).toBe(false);
    const allPass = summarizeUat(Array(14).fill("pass"));
    expect(computeGate7Signal(allPass, ["ready", "not_started"]).evidenceComplete).toBe(false);
    expect(computeGate7Signal(allPass, ["ready"]).authorized).toBe(false);
  });
});

describe("library + disclaimer + critical blockers", () => {
  it("the UAT library covers the doc-34 §8 categories", () => {
    expect(UAT_SCENARIO_LIBRARY.length).toBeGreaterThanOrEqual(14);
    const cats = new Set(UAT_SCENARIO_LIBRARY.map((s) => s.category));
    for (const c of ["patient_registration", "billing_cashier", "prescription_pharmacy", "emergency_exception", "lab_radiology", "user_rbac", "bilingual_ui"]) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it("the disclaimer states evidence-only / not-authorization in both locales", () => {
    expect(GATE7_DISCLAIMER_FR).toMatch(/pas une autorisation/i);
    expect(GATE7_DISCLAIMER_EN).toMatch(/not an authorization/i);
  });

  it("the critical-blocker classes match the doc-34 §8 list", () => {
    expect([...CRITICAL_BLOCKER_CLASSES].sort()).toEqual(
      ["access_control_leak", "cross_hospital_leakage", "data_loss", "financial_calc_error", "missing_audit"].sort(),
    );
    expect(GATE7_CRITERIA.some((c) => c.key === "no_critical_blockers")).toBe(true);
  });
});
