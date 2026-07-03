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

// --- Phase 6.3 S4 — executive-dashboard extras (read-only, hospital-scoped, additive). ---

/** Registration timestamps since a moment — bucketed per day by the pure series helper. */
export function findPatientRegistrationDatesSince(hospitalId: string, since: Date) {
  return prisma.patient.findMany({
    where: { hospitalId, deletedAt: null, createdAt: { gte: since } },
    select: { createdAt: true },
  });
}

/** Lots still on hand that expire on/before `before` (pharmacy expiry alert count). */
export function countExpiringStockLots(hospitalId: string, before: Date) {
  return prisma.medicationStockBatch.count({
    where: { hospitalId, quantityOnHand: { gt: 0 }, expiryDate: { lte: before } },
  });
}

/** Diagnostic orders of one modality requested since a moment (cancelled excluded). */
export function countDiagnosticOrdersSince(
  hospitalId: string,
  since: Date,
  modality: "lab" | "radiology",
) {
  return prisma.diagnosticOrder.count({
    where: {
      hospitalId,
      modality,
      status: { not: "cancelled" },
      createdAt: { gte: since },
    },
  });
}

/** Diagnostic orders still in the pipeline (requested → in progress → result entered). */
export function countPendingDiagnosticOrders(hospitalId: string) {
  return prisma.diagnosticOrder.count({
    where: {
      hospitalId,
      status: { in: ["requested", "payment_confirmed", "in_progress", "result_entered"] },
    },
  });
}
