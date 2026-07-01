import { beforeEach, describe, expect, it } from "vitest";

import {
  closeCashierShift,
  correctCashierShift,
  openCashierShift,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3F-4 — Cashier shift DB enforcement (doc 34 §12). VERIFIES the Phase 2 hardening delivered
 * as H3 (commit 17a9fa1): at most ONE open cashier shift per (cashier, hospital), enforced by a
 * partial unique index `CashierShift_one_open_per_cashier WHERE status='open'` (race-safe) + a P2002
 * friendly-error catch; status-guarded close; controlled, audited correction. Maps to doc 34 §12.14.
 * No logic re-implemented. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

describe("integration: Phase 3F-4 cashier shift DB enforcement (verifies H3)", () => {
  beforeEach(resetTestDb);

  it("opening a SECOND shift while one is open is blocked", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await openCashierShift(cashier.actor, cashier.ctx, 10_000);
    await expect(openCashierShift(cashier.actor, cashier.ctx, 0)).rejects.toThrow(/déjà ouverte/i);
    expect(await prisma.cashierShift.count({ where: { hospitalId: HRB, status: "open" } })).toBe(1);
  });

  it("a CONCURRENT double-open is race-safe — exactly one shift opens (DB partial unique index)", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const results = await Promise.allSettled([
      openCashierShift(cashier.actor, cashier.ctx, 1000),
      openCashierShift(cashier.actor, cashier.ctx, 2000),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(fulfilled).toBe(1); // the DB index lets only one win the race
    expect(rejected).toBe(1);
    expect(await prisma.cashierShift.count({ where: { hospitalId: HRB, status: "open" } })).toBe(1);
  });

  it("a closed shift cannot be closed again (status-guarded)", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 5000);
    await closeCashierShift(cashier.actor, cashier.ctx, shift.id);
    await expect(closeCashierShift(cashier.actor, cashier.ctx, shift.id)).rejects.toThrow();
    // Re-opening AFTER closing is allowed (no open shift remains) — the constraint is on OPEN only.
    const reopened = await openCashierShift(cashier.actor, cashier.ctx, 0);
    expect(reopened.status).toBe("open");
  });

  it("a closing correction is controlled and audited", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 5000);
    const closed = await closeCashierShift(cashier.actor, cashier.ctx, shift.id);
    expect(closed).not.toBeNull();
    const before = await prisma.auditLog.count({ where: { action: "cashier.closing_corrected", entityId: closed!.id } });
    await correctCashierShift(cashier.actor, cashier.ctx, closed!.id, "Écart de caisse", "Recompté : +500 FCFA");
    const after = await prisma.auditLog.count({ where: { action: "cashier.closing_corrected", entityId: closed!.id } });
    expect(after).toBe(before + 1);
  });
});
