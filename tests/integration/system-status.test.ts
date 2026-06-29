import { describe, expect, it } from "vitest";

import { getSystemStatus } from "@/server/services";

describe("integration: Phase 1A Batch 6 — system status / pilot readiness", () => {
  it("reports real signals; data mode is demo and the real-data path is disabled", async () => {
    const status = await getSystemStatus();
    expect(status.db.connected).toBe(true); // test DB reachable
    expect(status.db.serverTime).toBeInstanceOf(Date);
    expect(status.dataMode).toBe("demo");
    expect(status.realDataEnabled).toBe(false);
    expect(status.appVersion).toMatch(/phase1a/);

    // The "fake data only" readiness item must be satisfied (separation not bypassable).
    const fakeOnly = status.readiness.find((r) => r.label.includes("Données fictives"));
    expect(fakeOnly?.ok).toBe(true);
    // Backup infra is a supplier concern → reported as not an app responsibility.
    const backup = status.readiness.find((r) => r.label.includes("Sauvegarde"));
    expect(backup?.ok).toBe(false);
  });
});
