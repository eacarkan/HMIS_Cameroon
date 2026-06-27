import { beforeEach, describe, expect, it } from "vitest";

import { authenticateCredentials } from "@/server/services";
import { ACCOUNTS } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

describe("integration: auth + seed", () => {
  beforeEach(resetTestDb);

  it("seeds HRB-DEMO active + 8 hospitals + 5 users + 5 roles", async () => {
    const hospital = await prisma.hospital.findUnique({
      where: { code: "HRB-DEMO" },
    });
    expect(hospital?.isActive).toBe(true);
    expect(hospital?.isDemo).toBe(true);
    expect(await prisma.hospital.count()).toBe(8);
    expect(await prisma.hospital.count({ where: { isActive: true } })).toBe(1);
    expect(await prisma.user.count()).toBe(5);
    expect(await prisma.role.count()).toBe(5);
  });

  it("authenticates a demo user and writes auth.login", async () => {
    const actor = await authenticateCredentials(ACCOUNTS.cashier, "demo1234");
    expect(actor?.displayName).toBe("Solange ABENA");
    expect(actor?.roles).toContain("caissier");
    expect(actor?.hospitalIds).toContain("hosp-hrb-demo");

    const login = await prisma.auditLog.findFirst({
      where: { action: "auth.login", actorId: actor!.id },
    });
    expect(login).not.toBeNull();
    expect(login?.summary).toContain("Solange ABENA");
  });

  it("rejects invalid credentials", async () => {
    expect(await authenticateCredentials(ACCOUNTS.cashier, "wrong")).toBeNull();
    expect(
      await authenticateCredentials("nobody@hrb-demo.cm", "demo1234"),
    ).toBeNull();
  });
});
