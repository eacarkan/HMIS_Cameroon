import { beforeEach, describe, expect, it } from "vitest";

import { MAX_FAILED_ATTEMPTS } from "@/lib/account-security";
import { getDemoSharedPassword } from "@/lib/demo-password";
import { ONE_CLICK_DEMO_ROLES } from "@/lib/demo-access";
import { prisma } from "@/server/db";
import { authenticateCredentials, recordDemoSessionRequest } from "@/server/services";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 6C — one-click demo access. The selected roles resolve to seeded, active,
 * SYNTHETIC accounts; a one-click session writes a `demo.session_requested` audit; and the
 * F-02 account lockout is preserved on the credential path the one-click flow uses.
 */
const WRONG = "definitely-not-the-password";

describe("integration: Phase 6C demo access (one-click)", () => {
  beforeEach(resetTestDb);

  it("records a demo.session_requested audit for the resolved synthetic account", async () => {
    const cashier = ONE_CLICK_DEMO_ROLES.find((r) => r.key === "cashier")!;
    const before = await prisma.auditLog.count({ where: { action: "demo.session_requested" } });
    await recordDemoSessionRequest(cashier.email);
    const after = await prisma.auditLog.count({ where: { action: "demo.session_requested" } });
    expect(after).toBe(before + 1);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: cashier.email } });
    const entry = await prisma.auditLog.findFirst({
      where: { action: "demo.session_requested", actorId: user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeTruthy();
  });

  it("recordDemoSessionRequest is a no-op for an unknown (never-seeded) email", async () => {
    const before = await prisma.auditLog.count({ where: { action: "demo.session_requested" } });
    await recordDemoSessionRequest("nobody@nowhere.example");
    const after = await prisma.auditLog.count({ where: { action: "demo.session_requested" } });
    expect(after).toBe(before);
  });

  it("every selected one-click role resolves to a seeded, active, synthetic account", async () => {
    const seen = new Set<string>();
    for (const role of ONE_CLICK_DEMO_ROLES) {
      if (seen.has(role.email)) continue; // lab & radiology share one seeded account
      seen.add(role.email);
      expect(role.email).toMatch(/@hrb-demo\.cm$/);
      const actor = await authenticateCredentials(role.email, getDemoSharedPassword());
      expect(actor, `one-click account ${role.email} must authenticate`).not.toBeNull();
      expect(actor!.roles).toContain(role.roleCode);
    }
  });

  it("account lockout (F-02) is preserved for the one-click credential path", async () => {
    const cashier = ONE_CLICK_DEMO_ROLES.find((r) => r.key === "cashier")!;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(await authenticateCredentials(cashier.email, WRONG)).toBeNull();
    }
    // Even the correct synthetic demo password is now denied — the one-click sign-in
    // (which goes through authenticateCredentials) is blocked exactly the same way.
    expect(await authenticateCredentials(cashier.email, getDemoSharedPassword())).toBeNull();
  });
});
