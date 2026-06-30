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
    include: { batch: true },
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
