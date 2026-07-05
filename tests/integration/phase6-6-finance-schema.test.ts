import { beforeEach, describe, expect, it } from "vitest";

import {
  createInvoice,
  createPatientForActor,
  openEncounter,
  recordPayment,
} from "@/server/services";
import { seedDemoFinance, FINANCE_SENTINEL_KEY } from "@/scripts/seed-demo-finance";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 6.6 · Unit 1 — schema / migration + seed support (DB-backed). Proves the ADDITIVE finance overlay
 * at the DB layer: (1) a payment is on at most ONE deposit slip; (2) integer-FCFA CHECK constraints reject
 * negative / non-positive amounts; (3) overlay rows are hospital-scoped (isolated by hospitalId); (4) the
 * synthetic finance seed is deterministic + idempotent; and — the money-path guarantee — (5) a complete
 * deposit → bank-line → match flow NEVER mutates an Invoice or Payment money field. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga"; // a hospital no seeded operational user belongs to
const HRB_CODE = "HRB-DEMO";

async function cashPayment(amount: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "DEPOT", givenName: "Probe", sex: "male",
    dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale", reason: "Bilan",
  });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [
    { label: "Consultation", unitAmount: amount, quantity: 1 },
  ]);
  const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
    amount, method: "cash",
  });
  return { invoice, payment };
}

/** Sorted snapshot of every Invoice + Payment MONEY field (+ soft-delete flags) — the assertion surface
 * for zero-mutation. Deliberately EXCLUDES the MoMo snapshot columns: the seed legitimately writes those
 * non-money metadata, so they must not be part of the money-mutation guard. */
async function moneySnapshot() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { id: "asc" },
    select: { id: true, totalAmount: true, status: true, invoiceNumber: true, deletedAt: true },
  });
  const payments = await prisma.payment.findMany({
    orderBy: { id: "asc" },
    select: { id: true, amount: true, status: true, receiptNumber: true, method: true, paidAt: true, deletedAt: true },
  });
  return { invoices, payments };
}

describe("integration: Phase 6.6 finance schema + seed", () => {
  beforeEach(resetTestDb);

  // ---- (1) one active slip per payment (DB @@unique([hospitalId, paymentId])) ----
  it("rejects putting the same payment on two deposit slips (unique membership)", async () => {
    const { payment } = await cashPayment(3000);
    const slipA = await prisma.depositSlip.create({
      data: { hospitalId: HRB, slipNumber: "HRB-DEMO-BV-2026-000001", depositDate: new Date(), declaredTotalFcfa: 3000, computedPaymentTotalFcfa: 3000 },
    });
    const slipB = await prisma.depositSlip.create({
      data: { hospitalId: HRB, slipNumber: "HRB-DEMO-BV-2026-000002", depositDate: new Date(), declaredTotalFcfa: 0, computedPaymentTotalFcfa: 0 },
    });
    await prisma.depositSlipPayment.create({ data: { hospitalId: HRB, depositSlipId: slipA.id, paymentId: payment.id } });
    await expect(
      prisma.depositSlipPayment.create({ data: { hospitalId: HRB, depositSlipId: slipB.id, paymentId: payment.id } }),
    ).rejects.toThrow();
    // Two DIFFERENT payments may share one slip (the unique is per-payment, not per-slip).
    const second = await cashPayment(1500);
    await expect(
      prisma.depositSlipPayment.create({ data: { hospitalId: HRB, depositSlipId: slipA.id, paymentId: second.payment.id } }),
    ).resolves.toBeTruthy();
  });

  // ---- (2) integer-FCFA CHECK constraints ----
  it("rejects negative deposit-slip totals, a negative bank-line amount, and a non-positive match", async () => {
    await expect(
      prisma.depositSlip.create({
        data: { hospitalId: HRB, slipNumber: "HRB-DEMO-BV-2026-000090", depositDate: new Date(), declaredTotalFcfa: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.bankStatementLine.create({
        data: { hospitalId: HRB, valueDate: new Date(), amountFcfa: -1, label: "x" },
      }),
    ).rejects.toThrow();
    const slip = await prisma.depositSlip.create({
      data: { hospitalId: HRB, slipNumber: "HRB-DEMO-BV-2026-000091", depositDate: new Date() },
    });
    const line = await prisma.bankStatementLine.create({
      data: { hospitalId: HRB, valueDate: new Date(), amountFcfa: 5000, label: "x" },
    });
    await expect(
      prisma.bankReconciliationMatch.create({
        data: { hospitalId: HRB, bankStatementLineId: line.id, depositSlipId: slip.id, matchedAmountFcfa: 0 },
      }),
    ).rejects.toThrow();
    // A positive match is accepted (sanity).
    await expect(
      prisma.bankReconciliationMatch.create({
        data: { hospitalId: HRB, bankStatementLineId: line.id, depositSlipId: slip.id, matchedAmountFcfa: 5000 },
      }),
    ).resolves.toBeTruthy();
  });

  // ---- (3) hospital scoping: an OTHER-hospital overlay row is invisible under HRB's scope ----
  it("isolates overlay rows by hospitalId (an OTHER-hospital slip/line is not visible under HRB)", async () => {
    const otherSlip = await prisma.depositSlip.create({
      data: { hospitalId: OTHER, slipNumber: "HRN-BV-1", depositDate: new Date() },
    });
    const otherLine = await prisma.bankStatementLine.create({
      data: { hospitalId: OTHER, valueDate: new Date(), amountFcfa: 4000, label: "hrn" },
    });
    expect(await prisma.depositSlip.findFirst({ where: { hospitalId: HRB, id: otherSlip.id } })).toBeNull();
    expect(await prisma.bankStatementLine.findFirst({ where: { hospitalId: HRB, id: otherLine.id } })).toBeNull();
    expect(await prisma.depositSlip.count({ where: { hospitalId: HRB } })).toBe(0);
  });

  // ---- (4) synthetic finance seed: deterministic shape + idempotent ----
  it("seeds a deterministic finance overlay and is a no-op on re-run", async () => {
    // A controlled fixture: 12 recorded cash payments (→ 3 slips of 5/5/2: prepared/deposited/cleared).
    const created = [];
    for (let i = 0; i < 12; i++) created.push((await cashPayment(2000 + i * 100)).payment);

    const first = await seedDemoFinance(prisma, { hospitalId: HRB, hospitalCode: HRB_CODE });
    expect(first.skipped).toBe(false);
    expect(first.slips).toBe(3);
    expect(first.slipPayments).toBe(12);
    expect(first.matches).toBe(1);

    const slips = await prisma.depositSlip.findMany({ where: { hospitalId: HRB }, orderBy: { slipNumber: "asc" } });
    expect(slips.map((s) => s.slipNumber)).toEqual([
      "HRB-DEMO-BV-2026-000001", "HRB-DEMO-BV-2026-000002", "HRB-DEMO-BV-2026-000003",
    ]);
    expect(slips.map((s) => s.status)).toEqual(["prepared", "deposited", "cleared"]);
    // Each slip's computed total equals the Σ of its linked payments (read-only, no mutation).
    for (const slip of slips) {
      const links = await prisma.depositSlipPayment.findMany({ where: { depositSlipId: slip.id }, select: { paymentId: true } });
      const linkedPayments = await prisma.payment.findMany({ where: { id: { in: links.map((l) => l.paymentId) } }, select: { amount: true } });
      const sum = linkedPayments.reduce((s, p) => s + p.amount, 0);
      expect(slip.computedPaymentTotalFcfa).toBe(sum);
      expect(slip.varianceFcfa).toBe(slip.declaredTotalFcfa - slip.computedPaymentTotalFcfa);
    }
    // The cleared slip reconciles (declared == cleared) and carries a bank match; a disputed-style
    // variance never appears here because 12 payments make exactly 3 slips (no disputed slip).
    const cleared = slips.find((s) => s.status === "cleared")!;
    expect(cleared.clearedAmountFcfa).toBe(cleared.declaredTotalFcfa);

    // Idempotency: a second run (sentinel present) is a skipped no-op — row counts unchanged.
    const before = {
      slips: await prisma.depositSlip.count(),
      links: await prisma.depositSlipPayment.count(),
      lines: await prisma.bankStatementLine.count(),
      matches: await prisma.bankReconciliationMatch.count(),
    };
    const second = await seedDemoFinance(prisma, { hospitalId: HRB, hospitalCode: HRB_CODE });
    expect(second.skipped).toBe(true);
    expect(await prisma.setting.findUnique({ where: { hospitalId_key: { hospitalId: HRB, key: FINANCE_SENTINEL_KEY } } })).not.toBeNull();
    expect(await prisma.depositSlip.count()).toBe(before.slips);
    expect(await prisma.depositSlipPayment.count()).toBe(before.links);
    expect(await prisma.bankStatementLine.count()).toBe(before.lines);
    expect(await prisma.bankReconciliationMatch.count()).toBe(before.matches);
  });

  // ---- (4b) MoMo backfill writes ONLY the snapshot metadata, never a money field ----
  it("backfills Mobile-Money operator/reference without touching payment amount/status/receipt", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "MOMO", givenName: "Probe", sex: "female", dateOfBirth: new Date("1992-02-02"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 4000, quantity: 1 }]);
    const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 4000, method: "mobile_money" });

    await seedDemoFinance(prisma, { hospitalId: HRB, hospitalCode: HRB_CODE });

    const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(after.mobileMoneyOperator).toMatch(/MTN|ORANGE/);
    expect(after.mobileMoneyReference).toMatch(/^MM-(MTN|ORANGE)-\d{6}$/);
    // Money fields untouched.
    expect(after.amount).toBe(4000);
    expect(after.status).toBe("recorded");
    expect(after.receiptNumber).toBe(payment.receiptNumber);
    expect(after.method).toBe("mobile_money");
  });

  // ---- (5) zero invoice/payment money mutation through a full deposit → line → match flow ----
  it("a complete deposit → bank-line → match flow mutates NO Invoice or Payment money field", async () => {
    const p1 = await cashPayment(5000);
    const p2 = await cashPayment(3000);

    const before = await moneySnapshot();

    // Build the overlay directly (as the Unit-4 service will): slip + memberships + bank line + match.
    const slip = await prisma.depositSlip.create({
      data: {
        hospitalId: HRB, slipNumber: "HRB-DEMO-BV-2026-000001", depositDate: new Date(),
        status: "cleared", declaredTotalFcfa: 8000, computedPaymentTotalFcfa: 8000,
        clearedAmountFcfa: 8000, varianceFcfa: 0,
      },
    });
    await prisma.depositSlipPayment.create({ data: { hospitalId: HRB, depositSlipId: slip.id, paymentId: p1.payment.id } });
    await prisma.depositSlipPayment.create({ data: { hospitalId: HRB, depositSlipId: slip.id, paymentId: p2.payment.id } });
    const line = await prisma.bankStatementLine.create({
      data: { hospitalId: HRB, valueDate: new Date(), amountFcfa: 8000, label: "Versement", matchStatus: "matched", isMock: true },
    });
    await prisma.bankReconciliationMatch.create({
      data: { hospitalId: HRB, bankStatementLineId: line.id, depositSlipId: slip.id, matchedAmountFcfa: 8000 },
    });

    const after = await moneySnapshot();
    expect(after).toEqual(before); // byte-for-byte: no invoice/payment money field changed
  });

  // ---- (5b) the REAL shipping seed mutates no money field (protects seedDemoFinance itself) ----
  it("running seedDemoFinance mutates NO Invoice/Payment money field (only overlay rows + MoMo metadata)", async () => {
    for (let i = 0; i < 8; i++) await cashPayment(2000 + i * 100);
    // one mobile_money payment so the MoMo-backfill branch also runs inside the snapshot window
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "SEED", givenName: "Momo", sex: "male", dateOfBirth: new Date("1991-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const inv = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 6000, quantity: 1 }]);
    await recordPayment(cashier.actor, cashier.ctx, inv.id, { amount: 6000, method: "mobile_money" });

    const before = await moneySnapshot();
    const res = await seedDemoFinance(prisma, { hospitalId: HRB, hospitalCode: HRB_CODE });
    const after = await moneySnapshot();

    // The seed did real overlay work…
    expect(res.slips).toBeGreaterThan(0);
    expect(res.momoBackfilled).toBeGreaterThan(0);
    expect(await prisma.depositSlip.count()).toBeGreaterThan(0);
    expect(await prisma.bankStatementLine.count()).toBeGreaterThan(0);
    // …yet NO Invoice/Payment money field (amount/status/receipt/totals/deletedAt) changed. The MoMo
    // operator/reference snapshots are deliberately OUTSIDE moneySnapshot (non-money metadata).
    expect(after).toEqual(before);
  });
});
