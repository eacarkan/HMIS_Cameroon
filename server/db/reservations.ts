import type { ReservationStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2D-4 — stock-reservation data-access (hospital-scoped, integer quantities). */

export type CreateReservationData = {
  hospitalId: string;
  prescriptionId: string;
  prescriptionItemId: string;
  medicationId: string;
  batchId: string;
  quantity: number;
  createdById?: string | null;
};

export function createReservation(data: CreateReservationData) {
  return prisma.stockReservation.create({ data });
}

export function listReservationsForPrescription(
  hospitalId: string,
  prescriptionId: string,
  status?: ReservationStatus,
) {
  return prisma.stockReservation.findMany({
    where: { hospitalId, prescriptionId, ...(status ? { status } : {}) },
    include: { batch: true, prescriptionItem: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Active reservations for one prescription LINE, FEFO-ordered (for dispensing in 2D-5). */
export function listActiveReservationsForItem(hospitalId: string, prescriptionItemId: string) {
  return prisma.stockReservation.findMany({
    where: { hospitalId, prescriptionItemId, status: "active" },
    include: { batch: true },
    orderBy: [{ batch: { expiryDate: "asc" } }, { createdAt: "asc" }],
  });
}

/** One reservation by id (hospital-scoped) with its batch + prescription line — for the FEFO override. */
export function findReservationById(hospitalId: string, id: string) {
  return prisma.stockReservation.findFirst({
    where: { id, hospitalId },
    include: { batch: true, prescriptionItem: true },
  });
}

/** Active reservations created strictly before `cutoff` — the 48h non-collection sweep. */
export function findActiveReservationsOlderThan(hospitalId: string, cutoff: Date) {
  return prisma.stockReservation.findMany({
    where: { hospitalId, status: "active", createdAt: { lt: cutoff } },
    include: { batch: true, prescription: true },
    orderBy: { createdAt: "asc" },
  });
}

export function setReservationStatus(
  hospitalId: string,
  id: string,
  status: ReservationStatus,
  stamps: Partial<{ releasedAt: Date; consumedAt: Date }> = {},
) {
  return prisma.stockReservation.updateMany({ where: { id, hospitalId }, data: { status, ...stamps } });
}

/**
 * Phase 2D-6 — re-point an ACTIVE reservation from its FEFO batch onto a deliberately chosen batch
 * (Pharmacist-in-Charge override). Atomic: move the reserved hold from the source batch to the target
 * and flag the reservation. Optimistic guards (the target's `quantityReserved` is unchanged since the
 * caller read it; the reservation is still active on the source batch) make a concurrent change abort
 * the whole transaction rather than over-reserve. Validation (same medication, not expired, enough
 * available, mandatory reason) is performed by the service via `validateFefoOverride` before this call.
 */
export async function overrideReservationBatch(params: {
  hospitalId: string;
  reservationId: string;
  fromBatchId: string;
  toBatchId: string;
  quantity: number;
  targetReservedSeen: number; // the target batch's quantityReserved as read during validation
  overrideById: string;
  reason: string;
}) {
  const {
    hospitalId,
    reservationId,
    fromBatchId,
    toBatchId,
    quantity,
    targetReservedSeen,
    overrideById,
    reason,
  } = params;

  return prisma.$transaction(async (tx) => {
    // Move the hold onto the target — only if its reserved count is exactly what validation saw.
    const inc = await tx.medicationStockBatch.updateMany({
      where: { id: toBatchId, hospitalId, quantityReserved: targetReservedSeen },
      data: { quantityReserved: { increment: quantity } },
    });
    if (inc.count === 0) {
      throw new Error("Le stock du lot choisi a changé — veuillez réessayer la dérogation.");
    }
    // Release the hold on the source batch — guarded so it can never drive reserved below zero (a
    // concurrent dispense/release of the same lot makes this match 0 rows and abort the transaction
    // with a clear message rather than relying on the CHECK constraint's generic error).
    const dec = await tx.medicationStockBatch.updateMany({
      where: { id: fromBatchId, hospitalId, quantityReserved: { gte: quantity } },
      data: { quantityReserved: { decrement: quantity } },
    });
    if (dec.count === 0) {
      throw new Error("Le stock du lot d'origine a changé — veuillez réessayer la dérogation.");
    }
    // Re-point the reservation — only if it is still active on the source batch.
    const rep = await tx.stockReservation.updateMany({
      where: { id: reservationId, hospitalId, status: "active", batchId: fromBatchId },
      data: {
        batchId: toBatchId,
        isFefoOverride: true,
        overrideReason: reason,
        overrideById,
        overrideAt: new Date(),
      },
    });
    if (rep.count === 0) {
      throw new Error("La réservation a changé — veuillez réessayer la dérogation.");
    }
    return tx.stockReservation.findFirst({ where: { id: reservationId, hospitalId }, include: { batch: true } });
  });
}
