import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

/**
 * Phase 6D — the public health route returns a safe, non-sensitive status payload:
 * app up, environment + data-mode markers, synthetic-only, live-integrations off, and
 * NO secrets / connection strings / patient data.
 */
describe("unit: Phase 6D health route", () => {
  it("returns a 200 with a safe status payload", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("santegrid");
    expect(body.syntheticDataOnly).toBe(true);
    expect(body.liveIntegrations).toBe(false);
    expect(body.mpiLive).toBe(false);
    expect(typeof body.appVersion).toBe("string");
  });

  it("leaks no secrets, connection strings, or passwords", async () => {
    const serialized = JSON.stringify(await GET().json());
    expect(serialized).not.toMatch(/postgres(ql)?:\/\//i);
    expect(serialized).not.toMatch(/auth_secret/i);
    expect(serialized.toLowerCase()).not.toContain("password");
  });
});
