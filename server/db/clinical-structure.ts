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

// --- Phase 1 (Gate 3) scoped lookups + updates. Service layer enforces RBAC/audit. ---

export function findObservationById(hospitalId: string, id: string) {
  return prisma.observation.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updateObservation(
  id: string,
  data: { type?: string; value?: string; unit?: string | null },
) {
  return prisma.observation.update({ where: { id }, data });
}

export function findDiagnosisById(hospitalId: string, id: string) {
  return prisma.diagnosis.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updateDiagnosis(
  id: string,
  data: { label?: string; code?: string | null; isPrimary?: boolean },
) {
  return prisma.diagnosis.update({ where: { id }, data });
}
