import { prisma } from "./prisma";

/**
 * Phase 6.6 — finance data-access (hospital-scoped; read + metadata-overlay only). Every function takes
 * `hospitalId` and filters by it. The reconciliation writes here create/annotate OVERLAY rows only —
 * they NEVER update an Invoice/Payment money field (that stays recordPayment → recordPaymentTx, F-01).
 */

// ============================ Unit 2 — Mobile Money per-operator report ============================

/** Recorded mobile_money payments in a [start, end) window, with the operator/reference snapshot. */
export function findMobileMoneyPaymentsInRange(hospitalId: string, start: Date, end: Date) {
  return prisma.payment.findMany({
    where: {
      hospitalId,
      status: "recorded",
      method: "mobile_money",
      deletedAt: null,
      paidAt: { gte: start, lt: end },
    },
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      amount: true,
      receiptNumber: true,
      paidAt: true,
      mobileMoneyOperator: true,
      mobileMoneyReference: true,
    },
  });
}

// ================================= Unit 3 — Receivables aging ======================================

/** Open invoices (issued | partially_paid, not deleted) with their RECORDED payments — for outstanding math. */
export function listOpenInvoicesWithPayments(hospitalId: string) {
  return prisma.invoice.findMany({
    where: { hospitalId, deletedAt: null, status: { in: ["issued", "partially_paid"] } },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      payments: {
        where: { status: "recorded", deletedAt: null },
        select: { amount: true },
      },
      encounter: { select: { patient: { select: { patientNumber: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Outstanding emergency-debt ledger entries (status = outstanding) — a hospital receivable/liability. */
export function listOutstandingEmergencyDebts(hospitalId: string) {
  return prisma.emergencyDebt.findMany({
    where: { hospitalId, status: "outstanding" },
    select: { id: true, amount: true, source: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

// ========================= Unit 5 — monthly revenue statement aggregates ===========================

/** Recorded payments in a [start, end) window (amount + method + MoMo operator) for revenue aggregation. */
export function findRecordedPaymentsInRange(hospitalId: string, start: Date, end: Date) {
  return prisma.payment.findMany({
    where: { hospitalId, status: "recorded", deletedAt: null, paidAt: { gte: start, lt: end } },
    select: { amount: true, method: true, mobileMoneyOperator: true },
  });
}

/** Count invoices ISSUED (not draft) in a [start, end) window (by createdAt) — context for the statement. */
export function countInvoicesIssuedInRange(hospitalId: string, start: Date, end: Date) {
  return prisma.invoice.count({
    where: {
      hospitalId,
      deletedAt: null,
      status: { not: "draft" },
      createdAt: { gte: start, lt: end },
    },
  });
}

// ================= Unit 4 — Deposit / bank reconciliation (overlay CRUD; no money mutation) =================

/** Create a deposit slip (status prepared, computed 0, variance = declared). Hospital-scoped. */
export function createDepositSlipRow(data: {
  hospitalId: string;
  slipNumber: string;
  depositDate: Date;
  declaredTotalFcfa: number;
  note?: string | null;
  createdById: string;
}) {
  return prisma.depositSlip.create({
    data: {
      hospitalId: data.hospitalId,
      slipNumber: data.slipNumber,
      depositDate: data.depositDate,
      status: "prepared",
      declaredTotalFcfa: data.declaredTotalFcfa,
      computedPaymentTotalFcfa: 0,
      clearedAmountFcfa: 0,
      varianceFcfa: data.declaredTotalFcfa,
      note: data.note ?? null,
      createdById: data.createdById,
    },
  });
}

/** All live deposit slips for a hospital (newest deposit first), with member + match counts. */
export function listDepositSlips(hospitalId: string) {
  return prisma.depositSlip.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { depositDate: "desc" },
    select: {
      id: true, slipNumber: true, depositDate: true, status: true,
      declaredTotalFcfa: true, computedPaymentTotalFcfa: true, clearedAmountFcfa: true, varianceFcfa: true, note: true,
      _count: { select: { payments: true, matches: true } },
    },
  });
}

/** One deposit slip with its linked payments + reconciliation matches. Hospital-scoped. */
export function findDepositSlipById(hospitalId: string, id: string) {
  return prisma.depositSlip.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: {
      payments: {
        where: { deletedAt: null },
        include: {
          payment: {
            select: { id: true, receiptNumber: true, amount: true, method: true, paidAt: true, mobileMoneyOperator: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        where: { deletedAt: null },
        include: {
          bankStatementLine: { select: { id: true, label: true, amountFcfa: true, valueDate: true, reference: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** A recorded payment fetched hospital-scoped (null when it belongs to another hospital → cross-hospital reject). */
export function findRecordedPaymentForLink(hospitalId: string, paymentId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, hospitalId, status: "recorded", deletedAt: null },
    select: { id: true, amount: true, hospitalId: true },
  });
}

/** Is this payment already a member of a live deposit slip? (Backs the one-active-slip guard.) */
export async function isPaymentOnActiveSlip(hospitalId: string, paymentId: string): Promise<boolean> {
  const n = await prisma.depositSlipPayment.count({ where: { hospitalId, paymentId, deletedAt: null } });
  return n > 0;
}

/** Link a recorded payment to a deposit slip (membership row). */
export function createDepositSlipPaymentRow(data: {
  hospitalId: string; depositSlipId: string; paymentId: string; linkedById: string;
}) {
  return prisma.depositSlipPayment.create({ data });
}

/** HARD-delete a slip↔payment membership (frees the payment for re-linking; hospital-scoped). */
export function deleteDepositSlipPaymentRow(hospitalId: string, depositSlipId: string, paymentId: string) {
  return prisma.depositSlipPayment.deleteMany({ where: { hospitalId, depositSlipId, paymentId } });
}

/** Recompute + persist a slip's computedPaymentTotalFcfa + variance from its live linked payments. */
export async function recomputeDepositSlipTotals(hospitalId: string, slipId: string) {
  const links = await prisma.depositSlipPayment.findMany({
    where: { hospitalId, depositSlipId: slipId, deletedAt: null },
    include: { payment: { select: { amount: true } } },
  });
  const computed = links.reduce((s, l) => s + l.payment.amount, 0);
  const slip = await prisma.depositSlip.findFirstOrThrow({
    where: { id: slipId, hospitalId }, select: { declaredTotalFcfa: true },
  });
  await prisma.depositSlip.updateMany({
    where: { id: slipId, hospitalId },
    data: { computedPaymentTotalFcfa: computed, varianceFcfa: slip.declaredTotalFcfa - computed },
  });
  return computed;
}

/** Set a slip's status (+ optional cleared amount + updater). Hospital-scoped. */
export function setDepositSlipStatusRow(
  hospitalId: string, slipId: string,
  data: { status: "prepared" | "deposited" | "cleared" | "disputed"; clearedAmountFcfa?: number; updatedById: string },
) {
  return prisma.depositSlip.updateMany({ where: { id: slipId, hospitalId }, data });
}

/** Persist a slip's cleared amount = Σ live matched amounts (recomputed after a match). */
export async function recomputeSlipClearedAmount(hospitalId: string, slipId: string) {
  const agg = await prisma.bankReconciliationMatch.aggregate({
    _sum: { matchedAmountFcfa: true },
    where: { hospitalId, depositSlipId: slipId, deletedAt: null },
  });
  const cleared = agg._sum.matchedAmountFcfa ?? 0;
  await prisma.depositSlip.updateMany({ where: { id: slipId, hospitalId }, data: { clearedAmountFcfa: cleared } });
  return cleared;
}

/** Create a batch of SYNTHETIC bank statement lines (isMock). Hospital-scoped. */
export function createBankStatementLines(
  rows: { hospitalId: string; valueDate: Date; amountFcfa: number; label: string; reference?: string | null; importBatchId: string; createdById: string }[],
) {
  return prisma.bankStatementLine.createMany({
    data: rows.map((r) => ({
      hospitalId: r.hospitalId, valueDate: r.valueDate, amountFcfa: r.amountFcfa, label: r.label,
      reference: r.reference ?? null, importBatchId: r.importBatchId, isMock: true, matchStatus: "unmatched", createdById: r.createdById,
    })),
  });
}

/** All live bank statement lines for a hospital (newest value date first). */
export function listBankStatementLines(hospitalId: string) {
  return prisma.bankStatementLine.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { valueDate: "desc" },
    select: { id: true, valueDate: true, amountFcfa: true, label: true, reference: true, matchStatus: true, importBatchId: true, isMock: true },
  });
}

/** One bank line fetched hospital-scoped (null cross-hospital). */
export function findBankStatementLineById(hospitalId: string, id: string) {
  return prisma.bankStatementLine.findFirst({
    where: { id, hospitalId, deletedAt: null },
    select: { id: true, hospitalId: true, amountFcfa: true, label: true, matchStatus: true },
  });
}

/** Σ of the live matched amounts against a bank line (for the over-match guard). */
export async function sumMatchedForBankLine(hospitalId: string, bankStatementLineId: string): Promise<number> {
  const agg = await prisma.bankReconciliationMatch.aggregate({
    _sum: { matchedAmountFcfa: true },
    where: { hospitalId, bankStatementLineId, deletedAt: null },
  });
  return agg._sum.matchedAmountFcfa ?? 0;
}

/** Create a reconciliation match row. Hospital-scoped. */
export function createBankReconciliationMatchRow(data: {
  hospitalId: string; bankStatementLineId: string; depositSlipId: string; matchedAmountFcfa: number; matchedById: string; note?: string | null;
}) {
  return prisma.bankReconciliationMatch.create({ data: { ...data, note: data.note ?? null } });
}

/** Set a bank line's derived match status. Hospital-scoped. */
export function setBankLineMatchStatusRow(hospitalId: string, id: string, matchStatus: "unmatched" | "matched" | "disputed") {
  return prisma.bankStatementLine.updateMany({ where: { id, hospitalId }, data: { matchStatus } });
}

/** Recorded payments NOT on any live deposit slip (candidates to link). Hospital-scoped. */
export async function listRecordedPaymentsNotOnSlip(hospitalId: string) {
  const linked = new Set(
    (await prisma.depositSlipPayment.findMany({ where: { hospitalId, deletedAt: null }, select: { paymentId: true } }))
      .map((r) => r.paymentId),
  );
  const payments = await prisma.payment.findMany({
    where: { hospitalId, status: "recorded", deletedAt: null },
    orderBy: { paidAt: "desc" },
    select: { id: true, receiptNumber: true, amount: true, method: true, paidAt: true },
  });
  return payments.filter((p) => !linked.has(p.id));
}
