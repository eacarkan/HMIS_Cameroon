import type { ConsultationStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Consultation data-access — hospital-scoped (D-011, 09 §5). */

export type CreateConsultationData = {
  hospitalId: string;
  encounterId: string;
  status: ConsultationStatus;
  reason: string;
  clinicalNote: string | null;
  vitals: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
  performedById: string;
  createdById: string;
};

export function createConsultation(data: CreateConsultationData) {
  return prisma.consultation.create({ data });
}

/** A single consultation within a hospital (Phase 1, Gate 3 — clinical-structure scope). */
export function findConsultationById(hospitalId: string, id: string) {
  return prisma.consultation.findFirst({
    where: { id, hospitalId, deletedAt: null },
  });
}

// --- Phase 1A (Batch 2) clinical note (hospital-scoped; service enforces RBAC/audit). ---

export type UpdateConsultationData = {
  status?: ConsultationStatus;
  clinicalNote?: string | null;
  vitals?: string | null;
  provisionalDiagnosis?: string | null;
  recommendation?: string | null;
  updatedById?: string;
};

export function updateConsultation(id: string, data: UpdateConsultationData) {
  return prisma.consultation.update({ where: { id }, data });
}

/** Full consultation for the summary / printable note — patient context + structured data. */
export function findConsultationDetail(hospitalId: string, id: string) {
  return prisma.consultation.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: {
      performedBy: true,
      encounter: { include: { patient: true } },
      observations: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      diagnoses: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
}
