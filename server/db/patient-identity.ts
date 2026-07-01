import { prisma } from "./prisma";

/**
 * Patient identity / contact access — hospital-scoped (Phase 1, Gate 2). Optional
 * contacts, administrative identifiers (HOSPITAL-LOCAL uniqueness — no national MPI,
 * no global de-duplication), and possible-duplicate hints (WARNING/REVIEW ONLY — no
 * merge, no survivorship). Every function filters by `hospitalId`. Minimal by design.
 */

export type CreatePatientContactData = {
  hospitalId: string;
  patientId: string;
  contactType: string;
  value: string;
  label?: string | null;
};

export function createPatientContact(data: CreatePatientContactData) {
  return prisma.patientContact.create({ data });
}

export function listPatientContacts(hospitalId: string, patientId: string) {
  return prisma.patientContact.findMany({
    where: { hospitalId, patientId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export type CreatePatientIdentifierData = {
  hospitalId: string;
  patientId: string;
  identifierType: string;
  value: string;
  issuingAuthority?: string | null;
};

export function createPatientIdentifier(data: CreatePatientIdentifierData) {
  return prisma.patientIdentifier.create({ data });
}

export function listPatientIdentifiers(hospitalId: string, patientId: string) {
  return prisma.patientIdentifier.findMany({
    where: { hospitalId, patientId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

/** Hospital-LOCAL lookup (never national/global): same value can exist in another hospital. */
export function findPatientIdentifier(
  hospitalId: string,
  identifierType: string,
  value: string,
) {
  return prisma.patientIdentifier.findFirst({
    where: { hospitalId, identifierType, value, deletedAt: null },
  });
}

export type CreateDuplicateCandidateData = {
  hospitalId: string;
  patientId: string;
  candidatePatientId: string;
  matchBasis: string;
};

/** Persist a possible-duplicate hint. Warning/review only — never merges patients. */
export function createDuplicateCandidate(data: CreateDuplicateCandidateData) {
  return prisma.patientDuplicateCandidate.create({ data });
}

export function listDuplicateCandidates(hospitalId: string) {
  return prisma.patientDuplicateCandidate.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
  });
}

// --- Phase 1 (Gate 3) scoped lookups + mutations. Service layer enforces RBAC/audit. ---

export function findPatientContactById(hospitalId: string, id: string) {
  return prisma.patientContact.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updatePatientContact(
  id: string,
  data: {
    contactType?: string;
    value?: string;
    label?: string | null;
    deletedAt?: Date | null;
  },
) {
  return prisma.patientContact.update({ where: { id }, data });
}

export function findPatientIdentifierById(hospitalId: string, id: string) {
  return prisma.patientIdentifier.findFirst({
    where: { id, hospitalId, deletedAt: null },
  });
}
export function updatePatientIdentifier(
  id: string,
  data: {
    identifierType?: string;
    value?: string;
    issuingAuthority?: string | null;
    isActive?: boolean;
    deletedAt?: Date | null;
  },
) {
  return prisma.patientIdentifier.update({ where: { id }, data });
}

export function findDuplicateCandidateById(hospitalId: string, id: string) {
  return prisma.patientDuplicateCandidate.findFirst({ where: { id, hospitalId } });
}
/** Update only the review status — never merges patients (warning/review only). */
export function updateDuplicateCandidateStatus(id: string, status: string) {
  return prisma.patientDuplicateCandidate.update({ where: { id }, data: { status } });
}
