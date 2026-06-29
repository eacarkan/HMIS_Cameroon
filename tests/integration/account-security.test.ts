import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  authenticateCredentials,
  changeOwnPassword,
  createUserForActor,
  getAuditEntry,
  recordSensitiveRead,
  resetUserPassword,
  SENSITIVE_READ_AUDIT_ENABLED,
  assignRoleForActor,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

describe("integration: Phase 1A Batch 4 — account security", () => {
  beforeEach(resetTestDb);

  it("a user changes their own password (policy enforced); old fails, new works", async () => {
    const { actor } = await loginAndSelect(ACCOUNTS.cashier);
    await expect(changeOwnPassword(actor, "wrong-current", "Nouveau1234")).rejects.toThrow(
      /actuel est incorrect/,
    );
    await expect(changeOwnPassword(actor, "demo1234", "weak")).rejects.toThrow(/8 caractères/);

    await changeOwnPassword(actor, "demo1234", "Nouveau1234");
    expect(await authenticateCredentials(ACCOUNTS.cashier, "demo1234")).toBeNull();
    expect(await authenticateCredentials(ACCOUNTS.cashier, "Nouveau1234")).not.toBeNull();
    expect(
      await prisma.auditLog.count({ where: { action: "auth.password_change", actorId: actor.id } }),
    ).toBe(1);
  });

  it("an admin resets a user's password (policy + audit + hospital scope)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      resetUserPassword(actor, ctx, "user-solange-abena", "weak"),
    ).rejects.toThrow(/8 caractères/);

    await resetUserPassword(actor, ctx, "user-solange-abena", "Reinit1234");
    expect(await authenticateCredentials(ACCOUNTS.cashier, "Reinit1234")).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "auth.password_reset" } })).toBe(1);

    // Non-admin cannot reset.
    const rec = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      resetUserPassword(rec.actor, rec.ctx, "user-solange-abena", "Reinit1234"),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("role-assignment safeguard rejects unknown role codes; create rejects weak passwords", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      assignRoleForActor(actor, ctx, "user-solange-abena", "superadmin"),
    ).rejects.toThrow(/non assignable/);
    await expect(
      createUserForActor(actor, ctx, {
        displayName: "X",
        email: "weakpw@hrb-demo.cm",
        password: "weak",
        roleCode: "agent_accueil",
      }),
    ).rejects.toThrow(/8 caractères/);
  });

  it("audit event detail is readable (audit.read) and hospital-scoped", async () => {
    const rec = await loginAndSelect(ACCOUNTS.reception);
    const some = await prisma.auditLog.findFirst({ where: { hospitalId: "hosp-hrb-demo" } });
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.director); // director has audit.read
    const entry = await getAuditEntry(actor, ctx, some!.id);
    expect(entry?.id).toBe(some!.id);
    // Reception lacks audit.read.
    await expect(getAuditEntry(rec.actor, rec.ctx, some!.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("sensitive-read hook is inert by default (writes nothing)", async () => {
    expect(SENSITIVE_READ_AUDIT_ENABLED).toBe(false);
    const before = await prisma.auditLog.count({ where: { action: "sensitive.read" } });
    await recordSensitiveRead({
      hospitalId: "hosp-hrb-demo",
      actorId: "user-awa-njoya",
      entityType: "Patient",
      entityId: "x",
      summary: "test",
    });
    const after = await prisma.auditLog.count({ where: { action: "sensitive.read" } });
    expect(after).toBe(before); // no-op until MINSANTE activates the policy
  });
});
