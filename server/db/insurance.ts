import type { ClaimStatus, EligibilityStatus, PreAuthStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4E — insurance / mutuelle data-access (hospital-scoped, integer FCFA). Payer registry, coverage
 * profiles, patient coverage links, pre-authorization + claim drafts. All MANUAL — no insurer API.
 * Status transitions are guarded `updateMany` claims (from → to) so a concurrent double-decision loses.
 */

// ---- Payers + coverage profiles ----

export function listPayers(hospitalId: string) {
  return prisma.payer.findMany({
    where: { hospitalId },
    orderBy: { code: "asc" },
    include: { profiles: { orderBy: { code: "asc" } } },
  });
}

export function findPayerById(hospitalId: string, id: string) {
  return prisma.payer.findFirst({ where: { id, hospitalId }, include: { profiles: true } });
}

export function findPayerByCode(hospitalId: string, code: string) {
  return prisma.payer.findFirst({ where: { hospitalId, code } });
}

export function createPayer(data: { hospitalId: string; code: string; name: string; kind: string; createdById?: string | null }) {
  return prisma.payer.create({ data });
}

export function findCoverageProfileByCode(hospitalId: string, code: string) {
  return prisma.coverageProfile.findFirst({ where: { hospitalId, code } });
}

export function createCoverageProfile(data: {
  hospitalId: string;
  payerId: string;
  code: string;
  name: string;
  coveragePercent: number;
  notes?: string | null;
}) {
  return prisma.coverageProfile.create({ data });
}

// ---- Patient coverage ----

export function findPatientForCoverage(hospitalId: string, patientId: string) {
  return prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true, patientNumber: true } });
}

export function listPatientCoverages(hospitalId: string, opts: { patientId?: string } = {}) {
  return prisma.patientCoverage.findMany({
    where: { hospitalId, ...(opts.patientId ? { patientId: opts.patientId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { payer: { select: { code: true, name: true } } },
  });
}

export function findPatientCoverageById(hospitalId: string, id: string) {
  return prisma.patientCoverage.findFirst({ where: { id, hospitalId } });
}

export function createPatientCoverage(data: {
  hospitalId: string;
  patientId: string;
  payerId: string;
  coverageProfileId?: string | null;
  memberNumber: string;
  createdById?: string | null;
}) {
  return prisma.patientCoverage.create({ data });
}

export async function setPatientCoverageEligibility(hospitalId: string, id: string, eligibilityStatus: EligibilityStatus) {
  const res = await prisma.patientCoverage.updateMany({ where: { id, hospitalId }, data: { eligibilityStatus } });
  return res.count;
}

// ---- Pre-authorization ----

export function listPreAuths(hospitalId: string) {
  return prisma.preAuthorizationRequest.findMany({ where: { hospitalId }, orderBy: { createdAt: "desc" }, take: 100 });
}

export function findPreAuthById(hospitalId: string, id: string) {
  return prisma.preAuthorizationRequest.findFirst({ where: { id, hospitalId } });
}

export function createPreAuth(data: {
  hospitalId: string;
  patientCoverageId: string;
  encounterId?: string | null;
  description: string;
  requestedById?: string | null;
}) {
  return prisma.preAuthorizationRequest.create({ data });
}

export async function decidePreAuthTx(
  hospitalId: string,
  id: string,
  data: { status: PreAuthStatus; decidedById: string; decisionReason?: string | null },
): Promise<number> {
  const res = await prisma.preAuthorizationRequest.updateMany({
    where: { id, hospitalId, status: "REQUESTED" },
    data,
  });
  return res.count;
}

// ---- Claim drafts ----

export function listClaims(hospitalId: string) {
  return prisma.claimDraft.findMany({ where: { hospitalId }, orderBy: { createdAt: "desc" }, take: 100 });
}

export function findClaimById(hospitalId: string, id: string) {
  return prisma.claimDraft.findFirst({ where: { id, hospitalId } });
}

export function countClaimsForHospital(hospitalId: string) {
  return prisma.claimDraft.count({ where: { hospitalId } });
}

export function createClaimDraft(data: {
  hospitalId: string;
  patientCoverageId: string;
  invoiceId?: string | null;
  claimNumber: string;
  amountClaimed: number;
  createdById?: string | null;
}) {
  return prisma.claimDraft.create({ data });
}

/** Guarded claim transition (from → to). Returns the update count (0 if not in the `from` state). */
export async function transitionClaimStatus(
  hospitalId: string,
  id: string,
  params: { from: ClaimStatus; to: ClaimStatus; decidedById?: string | null },
): Promise<number> {
  const res = await prisma.claimDraft.updateMany({
    where: { id, hospitalId, status: params.from },
    data: { status: params.to, ...(params.decidedById ? { decidedById: params.decidedById } : {}) },
  });
  return res.count;
}
