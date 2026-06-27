import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { listAuditEntries } from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";
import { runGoldenPath } from "../helpers/golden";

describe("integration: audit log (09 §7, 07 §11)", () => {
  beforeEach(resetTestDb);

  it("director reads the hospital-scoped log, newest first", async () => {
    await runGoldenPath();
    const dir = await loginAndSelect(ACCOUNTS.director);
    const entries = await listAuditEntries(dir.actor, dir.ctx, {});

    expect(entries.length).toBeGreaterThan(5);
    // every entry is scoped to HRB-DEMO
    expect(entries.every((e) => e.hospitalId === "hosp-hrb-demo")).toBe(true);
    // newest first
    const times = entries.map((e) => e.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("action filter narrows results", async () => {
    await runGoldenPath();
    const dir = await loginAndSelect(ACCOUNTS.director);
    const filtered = await listAuditEntries(dir.actor, dir.ctx, {
      action: "payment.record",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].action).toBe("payment.record");
  });

  it("reception cannot read the audit log, and the denial is not itself logged", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const before = await prisma.auditLog.count();
    await expect(
      listAuditEntries(reception.actor, reception.ctx, {}),
    ).rejects.toBeInstanceOf(AuthorizationError);
    const after = await prisma.auditLog.count();
    expect(after).toBe(before); // no recursive/noisy authz.denied for a read
  });
});
