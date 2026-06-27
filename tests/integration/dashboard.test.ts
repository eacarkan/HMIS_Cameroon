import { beforeEach, describe, expect, it } from "vitest";

import { getDashboardSummary } from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";
import { runGoldenPath } from "../helpers/golden";

describe("integration: dashboard (06 §11, 07 §10)", () => {
  beforeEach(resetTestDb);

  it("reads 1 / 1 / 3 000 FCFA after the golden path", async () => {
    await runGoldenPath();
    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);

    expect(summary.patientsToday).toBe(1);
    expect(summary.openEncounters).toBe(1);
    expect(summary.collectionsToday).toBe(3000);

    // Recent activity is the newest entries (capped), so it includes the payment;
    // the full audit log (queried directly) contains the patient creation.
    const actions = summary.recent.map((r) => r.action);
    expect(actions).toContain("payment.record");
    expect(summary.recent.length).toBeGreaterThan(0);
    expect(
      await prisma.auditLog.count({ where: { action: "patient.create" } }),
    ).toBe(1);
  });

  it("reads 0 / 0 / 0 on a freshly reset hospital", async () => {
    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);
    expect(summary.patientsToday).toBe(0);
    expect(summary.openEncounters).toBe(0);
    expect(summary.collectionsToday).toBe(0);
  });
});
