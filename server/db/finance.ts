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
