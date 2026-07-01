import { prisma } from "./prisma";

/** Phase 2D-1 — medication catalogue data-access (hospital-scoped). */

export type CreateMedicationData = {
  hospitalId: string;
  code: string;
  nameFr: string;
  nameEn: string;
  form: string;
  unit: string;
  strength?: string | null;
  displayOrder?: number;
  createdById?: string | null;
};

export function listMedications(hospitalId: string) {
  return prisma.medication.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}

export function listActiveMedications(hospitalId: string) {
  return prisma.medication.findMany({
    where: { hospitalId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}

export function findMedicationById(hospitalId: string, id: string) {
  return prisma.medication.findFirst({ where: { id, hospitalId, deletedAt: null } });
}

export function findMedicationByCode(hospitalId: string, code: string) {
  return prisma.medication.findFirst({ where: { hospitalId, code, deletedAt: null } });
}

export function createMedication(data: CreateMedicationData) {
  return prisma.medication.create({ data });
}

export function updateMedication(
  hospitalId: string,
  id: string,
  data: Partial<{
    nameFr: string;
    nameEn: string;
    form: string;
    unit: string;
    strength: string | null;
    isActive: boolean;
    displayOrder: number;
    updatedById: string | null;
  }>,
) {
  return prisma.medication.updateMany({ where: { id, hospitalId }, data });
}
