import { prisma } from "./prisma";

/** Encounter data-access — hospital-scoped (D-011, 09 §5). */

export type CreateEncounterData = {
  hospitalId: string;
  patientId: string;
  encounterNumber: string;
  serviceLabel: string;
  reason: string;
  assignedToId: string | null;
  createdById: string;
};

export function createEncounter(data: CreateEncounterData) {
  return prisma.encounter.create({ data });
}

/** A single encounter within a hospital, with patient + consultations + invoices. */
export function findEncounterById(hospitalId: string, id: string) {
  return prisma.encounter.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: {
      patient: true,
      assignedTo: true,
      consultations: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { performedBy: true },
      },
      invoices: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { items: true, payments: true },
      },
    },
  });
}
