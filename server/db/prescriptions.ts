import type { PrescriptionStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2D-2 — prescription data-access (hospital-scoped). */

export type CreatePrescriptionData = {
  hospitalId: string;
  prescriptionNumber: string;
  patientId: string;
  encounterId: string;
  prescribedById: string;
  notes?: string | null;
  createdById?: string | null;
  items: {
    medicationId: string;
    medicationLabel: string;
    unit: string;
    dosage: string;
    frequency?: string | null;
    duration: string;
    quantity: number;
    instructions?: string | null;
  }[];
};

export function createPrescriptionWithItems(data: CreatePrescriptionData) {
  const { items, ...rest } = data;
  return prisma.prescription.create({
    data: {
      ...rest,
      items: {
        create: items.map((it) => ({ hospitalId: data.hospitalId, ...it })),
      },
    },
    include: { items: true },
  });
}

const detailInclude = {
  items: { include: { medication: true } },
  patient: true,
  encounter: true,
  prescribedBy: true,
} as const;

export function findPrescriptionById(hospitalId: string, id: string) {
  return prisma.prescription.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: detailInclude,
  });
}

export function listPrescriptionsForEncounter(hospitalId: string, encounterId: string) {
  return prisma.prescription.findMany({
    where: { hospitalId, encounterId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { items: true, prescribedBy: true },
  });
}

export function listPrescriptions(hospitalId: string, status?: PrescriptionStatus) {
  return prisma.prescription.findMany({
    where: { hospitalId, deletedAt: null, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: { items: true, patient: true, prescribedBy: true },
  });
}

export function updatePrescriptionStatus(
  hospitalId: string,
  id: string,
  status: PrescriptionStatus,
  stamps: Partial<{ finalizedAt: Date; sentAt: Date; cancelledAt: Date }> = {},
) {
  return prisma.prescription.updateMany({
    where: { id, hospitalId },
    data: { status, ...stamps },
  });
}

/** Phase 2D-5 — record that the prescription was paid at the cashier (the dispensing precondition). */
export function setPrescriptionPaid(hospitalId: string, id: string, paidById: string) {
  return prisma.prescription.updateMany({
    where: { id, hospitalId },
    data: { isPaid: true, paidAt: new Date(), paidById },
  });
}

/** Prescriptions awaiting dispensing (sent or partially dispensed) — the pharmacy worklist. */
export function listPharmacyWorklist(hospitalId: string) {
  return prisma.prescription.findMany({
    where: { hospitalId, deletedAt: null, status: { in: ["sent_to_pharmacy", "partially_dispensed"] } },
    orderBy: { sentAt: "asc" },
    include: { items: true, patient: true, prescribedBy: true },
  });
}
