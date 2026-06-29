import type { EncounterStatus } from "@prisma/client";

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

// --- Phase 1A (Batch 1B) encounter lifecycle (hospital-scoped; service enforces RBAC/audit). ---

/** Update an encounter's status (+ closedAt when leaving `open`). */
export function updateEncounterStatus(
  id: string,
  status: EncounterStatus,
  closedAt: Date | null,
) {
  return prisma.encounter.update({ where: { id }, data: { status, closedAt } });
}

/** Update the encounter's service/department label (existing column — no schema change). */
export function updateEncounterService(id: string, serviceLabel: string) {
  return prisma.encounter.update({ where: { id }, data: { serviceLabel } });
}

/**
 * Read-only timeline source: the patient with encounters → consultations + invoices →
 * payments. Hospital-scoped; soft-deleted rows excluded. Composition is done in a pure lib.
 */
export function findPatientTimelineData(hospitalId: string, patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, hospitalId, deletedAt: null },
    include: {
      encounters: {
        where: { deletedAt: null },
        orderBy: { openedAt: "desc" },
        include: {
          consultations: { where: { deletedAt: null } },
          invoices: { where: { deletedAt: null }, include: { payments: true } },
        },
      },
    },
  });
}
