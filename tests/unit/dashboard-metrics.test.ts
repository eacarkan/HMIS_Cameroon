import { describe, expect, it } from "vitest";

import { dailyBillingBreakdown, visibleDashboardSections } from "@/lib/dashboard-metrics";

describe("unit: dashboard section visibility (role-specific)", () => {
  it("reception sees activity only", () => {
    expect(visibleDashboardSections(["agent_accueil"])).toEqual({
      activity: true,
      clinical: false,
      billing: false,
      management: false,
    });
  });
  it("doctor sees activity + clinical", () => {
    const s = visibleDashboardSections(["medecin"]);
    expect(s.activity).toBe(true);
    expect(s.clinical).toBe(true);
    expect(s.billing).toBe(false);
  });
  it("cashier sees activity + billing (not clinical)", () => {
    const s = visibleDashboardSections(["caissier"]);
    expect(s.billing).toBe(true);
    expect(s.clinical).toBe(false);
  });
  it("director sees everything incl. management", () => {
    expect(visibleDashboardSections(["directeur"])).toEqual({
      activity: true,
      clinical: true,
      billing: true,
      management: true,
    });
  });
});

describe("unit: daily billing breakdown", () => {
  it("totals recorded payments by mode and overall", () => {
    const r = dailyBillingBreakdown([
      { amount: 2000, method: "cash", status: "recorded" },
      { amount: 1000, method: "mobile_money", status: "recorded" },
      { amount: 7777, method: "cash", status: "cancelled" },
    ]);
    expect(r.total).toBe(3000);
    expect(r.count).toBe(2);
    expect(r.byMethod).toEqual([
      { method: "cash", total: 2000, count: 1 },
      { method: "mobile_money", total: 1000, count: 1 },
    ]);
  });
});
