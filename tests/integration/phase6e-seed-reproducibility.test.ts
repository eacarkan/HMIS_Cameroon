import { beforeEach, describe, expect, it } from "vitest";

import { getDemoSharedPassword } from "@/lib/demo-password";
import { ONE_CLICK_DEMO_ROLES } from "@/lib/demo-access";
import { prisma } from "@/server/db";
import { authenticateCredentials } from "@/server/services";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 6E — the synthetic seed / manual reset is reproducible: after a reset the demo
 * baseline is deterministic (ten synthetic accounts, HRB-DEMO), the demo accounts
 * authenticate, and a reset restores a CLEAN, UNLOCKED baseline (the manual-reset
 * guarantee behind the runbook).
 */
describe("integration: Phase 6E seed reproducibility / demo reset", () => {
  beforeEach(resetTestDb);

  it("seeds a deterministic synthetic baseline (ten @hrb-demo.cm accounts + HRB-DEMO)", async () => {
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(10);
    for (const u of users) expect(u.email).toMatch(/@hrb-demo\.cm$/);
    const hospital = await prisma.hospital.findFirst({ where: { code: "HRB-DEMO" } });
    expect(hospital).toBeTruthy();
  });

  it("every selected one-click demo account authenticates after seeding", async () => {
    const seen = new Set<string>();
    for (const role of ONE_CLICK_DEMO_ROLES) {
      if (seen.has(role.email)) continue;
      seen.add(role.email);
      expect(await authenticateCredentials(role.email, getDemoSharedPassword())).not.toBeNull();
    }
  });

  it("a reset restores a clean, unlocked baseline (lockout state cleared)", async () => {
    const email = "solange.abena@hrb-demo.cm";
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });
    // Dirty the account: simulate a locked, failed-login state.
    await prisma.user.update({
      where: { id: before.id },
      data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 3_600_000) },
    });
    // Re-seed (the manual reset the runbook performs).
    await resetTestDb();
    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
    // …and the account signs in again with the synthetic demo password.
    expect(await authenticateCredentials(email, getDemoSharedPassword())).not.toBeNull();
  });
});
