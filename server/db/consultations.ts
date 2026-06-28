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
