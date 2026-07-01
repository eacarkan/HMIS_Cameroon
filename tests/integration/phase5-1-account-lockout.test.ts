import { beforeEach, describe, expect, it } from "vitest";

import { getDemoSharedPassword } from "@/lib/demo-password";
import { MAX_FAILED_ATTEMPTS } from "@/lib/account-security";
import { prisma } from "@/server/db";
import { authenticateCredentials } from "@/server/services";
import { ACCOUNTS } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 5.1 (F-02) — account-lockout ENFORCEMENT in the credentials authorize path. Failed sign-ins are
 * persisted; N consecutive failures lock the account until `lockedUntil` (denying even a correct
 * password); a successful sign-in resets the counter. Unknown/locked accounts return the same generic
 * failure (no user enumeration). Deterministic time is achieved by writing `lockedUntil` directly.
 * Synthetic demo accounts only.
 */
const WRONG = "definitely-not-the-password";

async function userByEmail(email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

describe("integration: Phase 5.1 account lockout (F-02)", () => {
  beforeEach(resetTestDb);

  it("a failed sign-in increments the persisted counter", async () => {
    expect(await authenticateCredentials(ACCOUNTS.admin, WRONG)).toBeNull();
    expect((await userByEmail(ACCOUNTS.admin)).failedLoginCount).toBe(1);
  });

  it("the threshold locks the account, and a CORRECT password is then denied (+ audited)", async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(await authenticateCredentials(ACCOUNTS.admin, WRONG)).toBeNull();
    }
    const locked = await userByEmail(ACCOUNTS.admin);
    expect(locked.failedLoginCount).toBe(MAX_FAILED_ATTEMPTS);
    expect(locked.lockedUntil).toBeTruthy();
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    // Correct password is denied while locked.
    expect(await authenticateCredentials(ACCOUNTS.admin, getDemoSharedPassword())).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "auth.account_locked" } })).toBeGreaterThanOrEqual(1);
  });

  it("a successful sign-in after the lock EXPIRES resets the counter and stamps last success", async () => {
    const u = await userByEmail(ACCOUNTS.admin);
    // Simulate a lock that has already expired (deterministic time via a direct write).
    await prisma.user.update({ where: { id: u.id }, data: { failedLoginCount: MAX_FAILED_ATTEMPTS, lockedUntil: new Date(Date.now() - 60_000) } });
    const actor = await authenticateCredentials(ACCOUNTS.admin, getDemoSharedPassword());
    expect(actor).not.toBeNull();
    const after = await userByEmail(ACCOUNTS.admin);
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
    expect(after.lastSuccessfulLoginAt).toBeTruthy();
  });

  it("no user enumeration — an unknown email and a locked account both return a generic null; the unknown creates no record", async () => {
    const before = await prisma.user.count();
    expect(await authenticateCredentials("nobody@nowhere.example", WRONG)).toBeNull();
    expect(await prisma.user.count()).toBe(before); // unknown email creates nothing

    // Lock the admin, then the locked account also returns a plain null (indistinguishable from unknown).
    const u = await userByEmail(ACCOUNTS.admin);
    await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() + 60_000) } });
    expect(await authenticateCredentials(ACCOUNTS.admin, getDemoSharedPassword())).toBeNull();
  });

  it("demo users still authenticate normally after a reset/seed; a disabled account stays rejected", async () => {
    const actor = await authenticateCredentials(ACCOUNTS.cashier, getDemoSharedPassword());
    expect(actor?.email).toBe(ACCOUNTS.cashier);

    // A disabled account is rejected regardless of password (existing behaviour, unchanged).
    const u = await userByEmail(ACCOUNTS.doctor);
    await prisma.user.update({ where: { id: u.id }, data: { status: "disabled" } });
    expect(await authenticateCredentials(ACCOUNTS.doctor, getDemoSharedPassword())).toBeNull();
  });
});
