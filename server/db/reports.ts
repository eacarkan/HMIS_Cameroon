import { prisma } from "./prisma";

/**
 * Reporting data-access — hospital-scoped, read-only (09 §5, Gate 5B). Operational reads
 * over existing payment/invoice data for the cashier daily report. No accounting logic.
 */

/** Recorded payments for a hospital within a [start, end) day window, with context. */
export function findPaymentsForDay(hospitalId: string, start: Date, end: Date) {
  return prisma.payment.findMany({
    where: { hospitalId, status: "recorded", paidAt: { gte: start, lt: end } },
    orderBy: { paidAt: "asc" },
    include: {
      cashier: true,
      invoice: {
        include: { encounter: { include: { patient: true } } },
      },
    },
  });
}
