import { describe, expect, it } from "vitest";

import {
  canStartOneClickDemo,
  isPublicDemoLoginEnabled,
  isPublicSiteEnabled,
  isStakeholderDemo,
  resolveDeploymentEnvironment,
} from "@/lib/deployment-mode";

/**
 * Phase 6 — deployment-mode flags fail closed. Only the exact strings unlock the
 * public stakeholder-demo surface; unset / unexpected values are OFF / "local".
 */
describe("unit: deployment-mode flags (Phase 6)", () => {
  it("resolveDeploymentEnvironment honours only the exact 'stakeholder-demo'", () => {
    expect(resolveDeploymentEnvironment("stakeholder-demo")).toBe("stakeholder-demo");
    expect(resolveDeploymentEnvironment("production")).toBe("local");
    expect(resolveDeploymentEnvironment("Stakeholder-Demo")).toBe("local");
    expect(resolveDeploymentEnvironment("")).toBe("local");
    expect(resolveDeploymentEnvironment(undefined)).toBe("local");
  });

  it("isStakeholderDemo is true only for HMIS_ENVIRONMENT=stakeholder-demo", () => {
    expect(isStakeholderDemo({ HMIS_ENVIRONMENT: "stakeholder-demo" })).toBe(true);
    expect(isStakeholderDemo({ HMIS_ENVIRONMENT: "production" })).toBe(false);
    expect(isStakeholderDemo({})).toBe(false);
  });

  it("isPublicSiteEnabled is true only for the exact string 'true' (fails closed)", () => {
    expect(isPublicSiteEnabled({ HMIS_PUBLIC_SITE_ENABLED: "true" })).toBe(true);
    expect(isPublicSiteEnabled({ HMIS_PUBLIC_SITE_ENABLED: "TRUE" })).toBe(false);
    expect(isPublicSiteEnabled({ HMIS_PUBLIC_SITE_ENABLED: "1" })).toBe(false);
    expect(isPublicSiteEnabled({ HMIS_PUBLIC_SITE_ENABLED: "false" })).toBe(false);
    expect(isPublicSiteEnabled({})).toBe(false);
  });

  it("isPublicDemoLoginEnabled is true only for the exact string 'true'", () => {
    expect(isPublicDemoLoginEnabled({ HMIS_PUBLIC_DEMO_LOGIN_ENABLED: "true" })).toBe(true);
    expect(isPublicDemoLoginEnabled({ HMIS_PUBLIC_DEMO_LOGIN_ENABLED: "false" })).toBe(false);
    expect(isPublicDemoLoginEnabled({})).toBe(false);
  });

  it("canStartOneClickDemo requires BOTH stakeholder-demo mode AND the one-click flag", () => {
    // Both on → allowed.
    expect(
      canStartOneClickDemo({
        HMIS_ENVIRONMENT: "stakeholder-demo",
        HMIS_PUBLIC_DEMO_LOGIN_ENABLED: "true",
      }),
    ).toBe(true);
    // Flag on but NOT stakeholder-demo → refused (one-click never works outside stakeholder-demo).
    expect(
      canStartOneClickDemo({ HMIS_PUBLIC_DEMO_LOGIN_ENABLED: "true" }),
    ).toBe(false);
    expect(
      canStartOneClickDemo({
        HMIS_ENVIRONMENT: "production",
        HMIS_PUBLIC_DEMO_LOGIN_ENABLED: "true",
      }),
    ).toBe(false);
    // Stakeholder-demo but flag off → refused (default).
    expect(canStartOneClickDemo({ HMIS_ENVIRONMENT: "stakeholder-demo" })).toBe(false);
    // Nothing set → refused.
    expect(canStartOneClickDemo({})).toBe(false);
  });
});
