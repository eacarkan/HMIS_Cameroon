import type { PatientMatchStatus, Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4G — patient-matching data-access (hospital-scoped). Reads the minimal identity fields for local
 * candidate generation, persists canonical-pair candidates (the DB enforces one ACTIVE candidate per
 * (hospital, canonical pair) + rejects self-pairs), and applies GUARDED status transitions. Every write
 * here touches ONLY match records — never a Patient row.
 */

const CANDIDATE_INCLUDE = {
  sourcePatient: { select: { id: true, patientNumber: true, familyName: true, givenName: true, sex: true, dateOfBirth: true, isTemporaryIdentity: true } },
  candidatePatient: { select: { id: true, patientNumber: true, familyName: true, givenName: true, sex: true, dateOfBirth: true, isTemporaryIdentity: true } },
} as const;

/** Minimal identity fields for LOCAL, same-hospital candidate scoring (no cross-hospital read). */
export function listPatientsForMatching(hospitalId: string) {
  return prisma.patient.findMany({
    where: { hospitalId },
    select: {
      id: true, familyName: true, givenName: true, dateOfBirth: true, sex: true,
      phone: true, guardianPhone: true, estimatedAge: true, isEstimatedAge: true, isTemporaryIdentity: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export function listMatchCandidates(hospitalId: string, opts: { activeOnly?: boolean; take?: number } = {}) {
  return prisma.patientMatchCandidate.findMany({
    where: {
      hospitalId,
      ...(opts.activeOnly ? { status: { in: ["CANDIDATE", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"] } } : {}),
    },
    orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 100,
    include: CANDIDATE_INCLUDE,
  });
}

export function findMatchCandidateById(hospitalId: string, id: string) {
  return prisma.patientMatchCandidate.findFirst({ where: { id, hospitalId }, include: CANDIDATE_INCLUDE });
}

export function findActiveCandidateByPair(hospitalId: string, canonicalPairKey: string) {
  return prisma.patientMatchCandidate.findFirst({
    where: { hospitalId, canonicalPairKey, status: { in: ["CANDIDATE", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"] } },
  });
}

export function countActiveCandidates(hospitalId: string) {
  return prisma.patientMatchCandidate.count({
    where: { hospitalId, status: { in: ["CANDIDATE", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"] } },
  });
}

export function createMatchCandidate(data: {
  hospitalId: string;
  sourcePatientId: string;
  candidatePatientId: string;
  canonicalPairKey: string;
  score: number;
  signals: Prisma.InputJsonValue;
  createdById?: string | null;
}) {
  return prisma.patientMatchCandidate.create({ data });
}

/**
 * Guarded status transition (from → to). Returns the update count (0 if the row is not in `from`, so a
 * concurrent double-decision loses). Writes ONLY the match record — never the patient rows.
 */
export async function transitionMatchCandidate(
  hospitalId: string,
  id: string,
  params: { from: PatientMatchStatus; to: PatientMatchStatus; reviewedById?: string | null; reviewReason?: string | null; reviewedAt?: Date },
): Promise<number> {
  const res = await prisma.patientMatchCandidate.updateMany({
    where: { id, hospitalId, status: params.from },
    data: {
      status: params.to,
      ...(params.reviewedById !== undefined ? { reviewedById: params.reviewedById } : {}),
      ...(params.reviewReason !== undefined ? { reviewReason: params.reviewReason } : {}),
      ...(params.reviewedAt !== undefined ? { reviewedAt: params.reviewedAt } : {}),
    },
  });
  return res.count;
}
