import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateEnv } from "@/lib/env-validation";

/**
 * Phase 6D — the committed `.env.example` keeps one-click login and live integrations
 * OFF by default and carries only placeholders (no real secrets). Required-env validation
 * still fails closed on a missing var.
 */
describe("unit: Phase 6D deployment env defaults", () => {
  const envExample = readFileSync(".env.example", "utf8");

  it("keeps one-click login and live integrations OFF by default", () => {
    expect(envExample).toContain('HMIS_PUBLIC_DEMO_LOGIN_ENABLED="false"');
    expect(envExample).toContain('HMIS_INTEGRATION_LIVE_ENABLED="false"');
    expect(envExample).toContain('HMIS_MPI_LIVE_ENABLED="false"');
  });

  it("carries the stakeholder-demo markers", () => {
    expect(envExample).toContain('HMIS_ENVIRONMENT="stakeholder-demo"');
    expect(envExample).toContain('HMIS_SYNTHETIC_DATA_ONLY="true"');
    expect(envExample).toContain('HMIS_SHOW_SYNTHETIC_BANNER="true"');
  });

  it("does not embed a managed/production connection string or secret", () => {
    // Only the local placeholder DB URL is allowed; nothing pointing at a managed host.
    expect(envExample).not.toMatch(/@[a-z0-9.-]*neon\.tech/i);
    expect(envExample).not.toMatch(/@[a-z0-9.-]*\.vercel\.app/i);
  });

  it("required-env validation fails closed on a missing variable", () => {
    expect(validateEnv({ DATABASE_URL: "x", AUTH_SECRET: "y" }).ok).toBe(true);
    expect(validateEnv({ DATABASE_URL: "x" }).missing).toContain("AUTH_SECRET");
  });
});
