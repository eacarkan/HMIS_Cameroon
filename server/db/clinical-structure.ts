import { prisma } from "./prisma";

/**
 * Clinical structure access — hospital-scoped (Phase 1, Gate 2). Optional structured
 * Observations (vitals) and Diagnoses attached to a Consultation. The free-text
 * Consultation.vitals / .provisionalDiagnosis fields are KEPT during the transition.
 * Clinical actions still reference User; no Practitioner. Minimal by design.
 */

export type CreateObservationData = {
  hospitalId: string;
  consultationId: string;
  type: string;
  value: string;
  unit?: string | null;
};

export function createObservation(data: CreateObservationData) {
  return prisma.observation.create({ data });
}

export function listObservations(hospitalId: string, consultationId: string) {
  return prisma.observation.findMany({
    where: { hospitalId, consultationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export type CreateDiagnosisData = {
  hospitalId: string;
  consultationId: string;
  label: string;
  code?: string | null;
  isPrimary?: boolean;
};

export function createDiagnosis(data: CreateDiagnosisData) {
  return prisma.diagnosis.create({ data });
}

export function listDiagnoses(hospitalId: string, consultationId: string) {
  return prisma.diagnosis.findMany({
    where: { hospitalId, consultationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
