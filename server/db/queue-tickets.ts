import { Prisma, type QueueStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2F — per-service digital queue data-access (hospital-scoped; per-day sequential numbering). */

const detailInclude = {
  patient: { select: { familyName: true, givenName: true, patientNumber: true } },
  serviceUnit: { select: { nameFr: true } },
} as const;

export type CreateQueueTicketData = {
  hospitalId: string;
  serviceUnitId: string;
  patientId: string;
  queueDate: Date;
  isUrgent: boolean;
  createdById?: string | null;
};

/**
 * Create a queue ticket with the next sequential number for (hospital, service, day). Optimistic: read
 * the current max, attempt the insert, and on a unique-constraint clash (a concurrent ticket took the
 * number) retry. The `@@unique([hospitalId, serviceUnitId, queueDate, ticketNumber])` constraint is the
 * correctness backstop, so numbers never collide or skip under concurrency.
 */
export async function createQueueTicket(data: CreateQueueTicketData) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const agg = await prisma.queueTicket.aggregate({
      where: { hospitalId: data.hospitalId, serviceUnitId: data.serviceUnitId, queueDate: data.queueDate },
      _max: { ticketNumber: true },
    });
    const ticketNumber = (agg._max.ticketNumber ?? 0) + 1;
    try {
      return await prisma.queueTicket.create({
        data: {
          hospitalId: data.hospitalId,
          serviceUnitId: data.serviceUnitId,
          patientId: data.patientId,
          queueDate: data.queueDate,
          ticketNumber,
          isUrgent: data.isUrgent,
          createdById: data.createdById ?? null,
        },
        include: detailInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 5
      ) {
        continue; // the number was taken concurrently — recompute and retry
      }
      throw error;
    }
  }
  throw new Error("Impossible d'attribuer un numéro de file (réessayez).");
}

export function findQueueTicketById(hospitalId: string, id: string) {
  return prisma.queueTicket.findFirst({ where: { id, hospitalId }, include: detailInclude });
}

/** Tickets for a service on a day, ordered for the board (urgent first, then ticket number). */
export function listQueueForService(hospitalId: string, serviceUnitId: string, queueDate: Date) {
  return prisma.queueTicket.findMany({
    where: { hospitalId, serviceUnitId, queueDate },
    include: detailInclude,
    orderBy: [{ isUrgent: "desc" }, { ticketNumber: "asc" }],
  });
}

export function updateQueueTicketStatus(
  hospitalId: string,
  id: string,
  status: QueueStatus,
  stamps: Partial<{ calledAt: Date; completedAt: Date; cancelledAt: Date }> = {},
) {
  return prisma.queueTicket.updateMany({ where: { id, hospitalId }, data: { status, ...stamps } });
}

export function setQueueTicketUrgent(hospitalId: string, id: string, isUrgent: boolean) {
  return prisma.queueTicket.updateMany({ where: { id, hospitalId }, data: { isUrgent } });
}
