import { prisma } from "./prisma";

/** Phase 2D-8 — read-only pharmacy reporting data-access (hospital-scoped, aggregate, no patient data). */

/**
 * Dispensed lines since `since`, for the dispensing-volume report. Least-privilege `select`: returns
 * ONLY the aggregate fields the report uses (unit, quantity, the batch's medication id + name) — NOT
 * `prescriptionItemId` or anything patient-traceable, so no patient data can leak through this path.
 */
export function listDispenseItemsSince(hospitalId: string, since: Date) {
  return prisma.dispenseRecordItem.findMany({
    where: { hospitalId, dispenseRecord: { createdAt: { gte: since } } },
    select: {
      unit: true,
      quantity: true,
      batch: { select: { medicationId: true, medication: { select: { nameFr: true } } } },
    },
  });
}

/** Number of distinct dispense records since `since`. */
export function countDispenseRecordsSince(hospitalId: string, since: Date) {
  return prisma.dispenseRecord.count({ where: { hospitalId, createdAt: { gte: since } } });
}
