import { prisma } from "./prisma";

/** Phase 2D-3 — medication stock-batch data-access (hospital-scoped, integer quantities). */

export type CreateStockBatchData = {
  hospitalId: string;
  medicationId: string;
  batchNumber: string;
  expiryDate: Date;
  quantityReceived: number;
  quantityOnHand: number;
  receivedById?: string | null;
};

export function createStockBatch(data: CreateStockBatchData) {
  return prisma.medicationStockBatch.create({ data, include: { medication: true } });
}

export function listStockBatches(hospitalId: string, medicationId?: string) {
  return prisma.medicationStockBatch.findMany({
    where: { hospitalId, ...(medicationId ? { medicationId } : {}) },
    orderBy: [{ medicationId: "asc" }, { expiryDate: "asc" }],
    include: { medication: true },
  });
}

/** Batches for one medication, FEFO-ordered (earliest expiry first) — used by 2D-5/2D-6. */
export function listStockForMedication(hospitalId: string, medicationId: string) {
  return prisma.medicationStockBatch.findMany({
    where: { hospitalId, medicationId },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });
}

export function findStockBatchById(hospitalId: string, id: string) {
  return prisma.medicationStockBatch.findFirst({
    where: { id, hospitalId },
    include: { medication: true },
  });
}

/** Set absolute on-hand / reserved on a batch (used by dual-validated adjustments, 2D-7). */
export function adjustStockBatch(
  hospitalId: string,
  id: string,
  data: Partial<{ quantityOnHand: number; quantityReserved: number }>,
) {
  return prisma.medicationStockBatch.updateMany({ where: { id, hospitalId }, data });
}

/** Atomically apply integer DELTAS to a batch's on-hand / reserved (reservation + dispensing). */
export function incrementStockBatch(
  hospitalId: string,
  id: string,
  deltas: { quantityOnHand?: number; quantityReserved?: number },
) {
  const data: {
    quantityOnHand?: { increment: number };
    quantityReserved?: { increment: number };
  } = {};
  if (deltas.quantityOnHand !== undefined) data.quantityOnHand = { increment: deltas.quantityOnHand };
  if (deltas.quantityReserved !== undefined) {
    data.quantityReserved = { increment: deltas.quantityReserved };
  }
  return prisma.medicationStockBatch.updateMany({ where: { id, hospitalId }, data });
}
