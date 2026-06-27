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

export function recentAuditEntries(hospitalId: string, limit: number) {
  return prisma.auditLog.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });
}
