import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";
import { NAV_ITEMS, NAV_SECTIONS } from "@/components/layout/nav";

/**
 * Phase 5B — role navigation. The sidebar shows exactly the capability-permitted items, grouped into
 * ordered sections. These tests prove (a) each role sees only its permitted modules, (b) grouping hides
 * NOTHING (every permitted item lands in exactly one rendered section), and (c) no control/status module
 * is dropped by the polish.
 */
/** Mirror the sidebar's filter + grouping. */
function navFor(roles: string[]) {
  const items = NAV_ITEMS.filter((i) => can(roles, i.capability));
  const groups = NAV_SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) })).filter((g) => g.items.length > 0);
  return { items, groups };
}
const labels = (roles: string[]) => navFor(roles).items.map((i) => i.labelKey);

describe("unit: Phase 5B role navigation", () => {
  it("grouping hides NOTHING — every permitted item lands in exactly one section", () => {
    for (const roles of [["medecin"], ["caissier"], ["administrateur"], ["superviseur_central"], ["agent_accueil"], ["pharmacien"]]) {
      const { items, groups } = navFor(roles);
      const grouped = groups.flatMap((g) => g.items);
      expect(grouped).toHaveLength(items.length);
      expect(new Set(grouped.map((i) => i.href))).toEqual(new Set(items.map((i) => i.href)));
      // Every visible item declares a known section.
      for (const item of items) expect(NAV_SECTIONS.some((s) => s.key === item.section)).toBe(true);
    }
  });

  it("a clinical doctor sees clinical modules but NOT admin/integration/finance-admin modules", () => {
    const nav = labels(["medecin"]);
    expect(nav).toEqual(expect.arrayContaining(["dashboard", "patients", "consultations", "diagnostics"]));
    for (const forbidden of ["administration", "integration", "dhis2", "analytics", "insurance", "matchReview", "central"]) {
      expect(nav).not.toContain(forbidden);
    }
  });

  it("the cashier sees billing controls (never hidden) but not clinical-only / central modules", () => {
    const nav = labels(["caissier"]);
    expect(nav).toEqual(expect.arrayContaining(["billing", "brouillard", "refunds", "externalPayments", "insurance"]));
    expect(nav).not.toContain("central");
    expect(nav).not.toContain("integration");
  });

  it("the administrateur sees admin/integration modules but NOT central (no cross-hospital cap)", () => {
    const nav = labels(["administrateur"]);
    expect(nav).toEqual(expect.arrayContaining(["administration", "integration", "dhis2", "analytics", "matchReview", "audit"]));
    expect(nav).not.toContain("central");
  });

  it("the central supervisor sees a MINIMAL menu — central oversight, no patient-level modules", () => {
    const nav = labels(["superviseur_central"]);
    expect(nav).toContain("central");
    expect(nav).not.toContain("patients");
    expect(nav).not.toContain("consultations");
    expect(nav).not.toContain("billing");
    expect(nav).not.toContain("matchReview");
  });
});
