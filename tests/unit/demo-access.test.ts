import { describe, expect, it } from "vitest";

import {
  DEMO_DIRECTORY,
  ONE_CLICK_DEMO_ROLES,
  resolveOneClickDemoRole,
} from "@/lib/demo-access";

/**
 * Phase 6C — the demo directory + one-click allow-list are entirely SYNTHETIC, carry no
 * password, and expose one-click only for the selected roles (sensitive roles refused).
 */
describe("unit: Phase 6C demo-access data", () => {
  it("every directory account is synthetic (@hrb-demo.cm) and carries no password", () => {
    for (const e of DEMO_DIRECTORY) {
      expect(e.email).toMatch(/@hrb-demo\.cm$/);
      expect(Object.keys(e)).not.toContain("password");
    }
  });

  it("exposes exactly the seven selected one-click roles, all synthetic", () => {
    const keys = ONE_CLICK_DEMO_ROLES.map((r) => r.key);
    expect(keys).toEqual([
      "central_supervisor",
      "admin",
      "doctor",
      "cashier",
      "pharmacist",
      "lab_tech",
      "radiology_tech",
    ]);
    for (const r of ONE_CLICK_DEMO_ROLES) {
      expect(r.email).toMatch(/@hrb-demo\.cm$/);
      expect(Object.keys(r)).not.toContain("password");
    }
  });

  it("resolveOneClickDemoRole returns selected roles but refuses sensitive / unknown keys", () => {
    expect(resolveOneClickDemoRole("cashier")?.email).toBe("solange.abena@hrb-demo.cm");
    // lab and radiology share the seeded diagnostic-technician account.
    expect(resolveOneClickDemoRole("lab_tech")?.email).toBe("paul.ngono@hrb-demo.cm");
    expect(resolveOneClickDemoRole("radiology_tech")?.email).toBe("paul.ngono@hrb-demo.cm");
    // Sensitive / non-selected roles are NOT one-click.
    expect(resolveOneClickDemoRole("director")).toBeNull();
    expect(resolveOneClickDemoRole("validator")).toBeNull();
    expect(resolveOneClickDemoRole("reception")).toBeNull();
    expect(resolveOneClickDemoRole("nope")).toBeNull();
  });

  it("every one-click email is a one-click directory account (consistency)", () => {
    for (const r of ONE_CLICK_DEMO_ROLES) {
      const inDir = DEMO_DIRECTORY.find((e) => e.email === r.email);
      expect(inDir, `${r.email} must be in the directory`).toBeDefined();
      expect(inDir!.oneClick).toBe(true);
    }
    // Sensitive accounts are marked credential-only.
    expect(DEMO_DIRECTORY.find((e) => e.key === "director")!.oneClick).toBe(false);
    expect(DEMO_DIRECTORY.find((e) => e.key === "validator")!.oneClick).toBe(false);
  });
});
