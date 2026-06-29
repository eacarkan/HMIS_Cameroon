import { prisma } from "./prisma";

/** Dashboard read-only data-access — hospital-scoped (09 §5). */

export function countPatientsRegisteredSince(hospitalId: string, since: Date) {
  return prisma.patient.count({
    where: { hospitalId, deletedAt: null, createdAt: { gte: since } },
  });
}

export function countOpenEncounters(hospitalId: string) {
  return prisma.encounter.count({
    where: { hospitalId, deletedAt: null, status: "open" },
  });
}

export async function sumCollectionsSince(hospitalId: string, since: Date) {
  const result = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { hospitalId, status: "recorded", paidAt: { gte: since } },
  });
  return result._sum.amount ?? 0;
}

// --- Phase 1A (Batch 5) read-only daily aggregations (hospital-scoped). ---

export function countEncountersOpenedSince(hospitalId: string, since: Date) {
  return prisma.encounter.count({
    where: { hospitalId, deletedAt: null, openedAt: { gte: since } },
  });
}

export function countEncountersClosedSince(hospitalId: string, since: Date) {
  return prisma.encounter.count({
    where: {
      hospitalId,
      deletedAt: null,
      status: { in: ["closed", "cancelled"] },
      closedAt: { gte: since },
    },
  });
}

export function countConsultationsSince(hospitalId: string, since: Date) {
  return prisma.consultation.count({
    where: { hospitalId, deletedAt: null, createdAt: { gte: since } },
  });
}

export function countInvoicesSince(hospitalId: string, since: Date) {
  return prisma.invoice.count({
    where: { hospitalId, deletedAt: null, createdAt: { gte: since } },
  });
}

/** Recorded payments since a moment (for the billing/cashier summary by mode). */
export function findPaymentsSince(hospitalId: string, since: Date) {
  return prisma.payment.findMany({
    where: { hospitalId, status: "recorded", paidAt: { gte: since } },
    select: { amount: true, method: true, status: true },
  });
}

export function recentAuditEntries(hospitalId: string, limit: number) {
  return prisma.auditLog.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });
}
