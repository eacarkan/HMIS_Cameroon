import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  changeDepositSlipStatus,
  createDepositSlip,
  createInvoice,
  createPatientForActor,
  getReconciliationOverview,
  importSyntheticBankStatement,
  linkPaymentToSlip,
  matchBankLineToSlip,
  openEncounter,
  recordPayment,
  unlinkPaymentFromSlip,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 6.6 · Unit 4 — deposit / bank reconciliation (DB-backed). THE GUARANTEE: a complete deposit →
 * import → match → clear flow NEVER mutates an Invoice/Payment money field. Plus the §9 rules: no
 * over-match, one active slip per payment, cross-hospital rejection, cleared-only-when-reconciled, and an
 * audit trail on every action. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

async function recordedPayment(amount: number, method: "cash" | "mobile_money" = "cash") {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "VERS", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: amount, quantity: 1 }]);
  const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount, method });
  return { cashier, invoice, payment };
}

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

describe("integration: Phase 6.6 deposit/bank reconciliation", () => {
  beforeEach(resetTestDb);

  it("a full deposit → import → match → clear flow mutates NO invoice/payment money field", async () => {
    const p1 = await recordedPayment(5000);
    const p2 = await recordedPayment(3000);
    const cx = p1.cashier;
    const before = await moneySnapshot();

    const slip = await createDepositSlip(cx.actor, cx.ctx, { declaredTotalFcfa: 8000 });
    await linkPaymentToSlip(cx.actor, cx.ctx, { slipId: slip.id, paymentId: p1.payment.id });
    await linkPaymentToSlip(cx.actor, cx.ctx, { slipId: slip.id, paymentId: p2.payment.id });
    await changeDepositSlipStatus(cx.actor, cx.ctx, { slipId: slip.id, to: "deposited" });
    await importSyntheticBankStatement(cx.actor, cx.ctx);

    const line = await prisma.bankStatementLine.findFirstOrThrow({
      where: { hospitalId: HRB, amountFcfa: 8000, label: { contains: slip.slipNumber } },
    });
    await matchBankLineToSlip(cx.actor, cx.ctx, { slipId: slip.id, bankLineId: line.id, matchedAmountFcfa: 8000 });
    await changeDepositSlipStatus(cx.actor, cx.ctx, { slipId: slip.id, to: "cleared" });

    // Byte-for-byte: no invoice/payment money field changed by the entire reconciliation flow.
    expect(await moneySnapshot()).toEqual(before);

    const finalSlip = await prisma.depositSlip.findUniqueOrThrow({ where: { id: slip.id } });
    expect(finalSlip.status).toBe("cleared");
    expect(finalSlip.computedPaymentTotalFcfa).toBe(8000);
    expect(finalSlip.clearedAmountFcfa).toBe(8000);
    expect(finalSlip.varianceFcfa).toBe(0);

    // Every financial action audited.
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "deposit_slip.created" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "deposit_slip.payment_linked" } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "bank_statement.imported" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "bank_line.matched" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "deposit_slip.status_changed" } })).toBe(2);
  });

  it("rejects over-matching a bank line", async () => {
    const p = await recordedPayment(5000);
    const slip = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 5000 });
    await linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: p.payment.id });
    const line = await prisma.bankStatementLine.create({
      data: { hospitalId: HRB, valueDate: new Date(), amountFcfa: 5000, label: "x", isMock: true },
    });
    await matchBankLineToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, bankLineId: line.id, matchedAmountFcfa: 3000 });
    // remaining capacity is 2000; a further 3000 would over-match → rejected.
    await expect(
      matchBankLineToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, bankLineId: line.id, matchedAmountFcfa: 3000 }),
    ).rejects.toThrow(/surrapprochement|invalide/i);
  });

  it("serialises concurrent matches so a bank line can never be over-matched (row lock)", async () => {
    const p = await recordedPayment(10000);
    const slip = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 10000 });
    await linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: p.payment.id });
    const line = await prisma.bankStatementLine.create({
      data: { hospitalId: HRB, valueDate: new Date(), amountFcfa: 10000, label: "concurrent", isMock: true },
    });
    // Two concurrent 7000 matches: each fits (≤10000) but together over-match (14000). The row lock must
    // let exactly ONE through — the total matched can never exceed the line amount.
    const results = await Promise.allSettled([
      matchBankLineToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, bankLineId: line.id, matchedAmountFcfa: 7000 }),
      matchBankLineToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, bankLineId: line.id, matchedAmountFcfa: 7000 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const agg = await prisma.bankReconciliationMatch.aggregate({
      _sum: { matchedAmountFcfa: true }, where: { hospitalId: HRB, bankStatementLineId: line.id },
    });
    expect(agg._sum.matchedAmountFcfa ?? 0).toBeLessThanOrEqual(10000);
  });

  it("unlinking a payment removes the membership, recomputes the slip, frees re-linking, and mutates no money", async () => {
    const p = await recordedPayment(4000);
    const slip = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 4000 });
    const before = await moneySnapshot();

    await linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: p.payment.id });
    expect((await prisma.depositSlip.findUniqueOrThrow({ where: { id: slip.id } })).computedPaymentTotalFcfa).toBe(4000);

    await unlinkPaymentFromSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: p.payment.id });
    expect(await prisma.depositSlipPayment.count({ where: { depositSlipId: slip.id } })).toBe(0);
    expect((await prisma.depositSlip.findUniqueOrThrow({ where: { id: slip.id } })).computedPaymentTotalFcfa).toBe(0);

    // The freed payment can be re-linked (the membership hard-delete releases the @@unique).
    await expect(
      linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: p.payment.id }),
    ).resolves.toBeTruthy();

    // No Invoice/Payment money field changed by link → unlink → re-link.
    expect(await moneySnapshot()).toEqual(before);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "deposit_slip.payment_unlinked" } })).toBe(1);
  });

  it("prevents a payment from being on two active deposit slips", async () => {
    const p = await recordedPayment(4000);
    const a = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 4000 });
    const b = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 0 });
    await linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: a.id, paymentId: p.payment.id });
    await expect(
      linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: b.id, paymentId: p.payment.id }),
    ).rejects.toThrow(/déjà|actif/i);
  });

  it("rejects cross-hospital matching and unknown-payment linking", async () => {
    const p = await recordedPayment(3000);
    const slip = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 3000 });
    const otherLine = await prisma.bankStatementLine.create({
      data: { hospitalId: OTHER, valueDate: new Date(), amountFcfa: 3000, label: "hrn", isMock: true },
    });
    await expect(
      matchBankLineToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, bankLineId: otherLine.id, matchedAmountFcfa: 3000 }),
    ).rejects.toThrow(/introuvable|inter-hôpitaux/i);
    await expect(
      linkPaymentToSlip(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, paymentId: "does-not-exist" }),
    ).rejects.toThrow(/introuvable/i);
  });

  it("rejects invalid status transitions (skip + clear-without-reconcile)", async () => {
    const p = await recordedPayment(5000);
    const slip = await createDepositSlip(p.cashier.actor, p.cashier.ctx, { declaredTotalFcfa: 5000 });
    await expect(
      changeDepositSlipStatus(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, to: "cleared" }),
    ).rejects.toThrow(); // prepared → cleared skip
    await changeDepositSlipStatus(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, to: "deposited" });
    await expect(
      changeDepositSlipStatus(p.cashier.actor, p.cashier.ctx, { slipId: slip.id, to: "cleared" }),
    ).rejects.toThrow(/écart|invalide/i); // cleared 0 ≠ declared 5000
  });

  it("denies reconciliation management to a role without reconciliation.manage (but allows view)", async () => {
    const director = await loginAndSelect(ACCOUNTS.director);
    await expect(createDepositSlip(director.actor, director.ctx, { declaredTotalFcfa: 1000 })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getReconciliationOverview(director.actor, director.ctx)).resolves.toBeTruthy();
  });
});
