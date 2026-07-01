import type { ExternalResultStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4C — external-result import data-access (hospital-scoped). Staging records ONLY — this never
 * touches the clinical DiagnosticOrder result. Status transitions are guarded (NEEDS_REVIEW → terminal)
 * so a concurrent double-review cannot promote twice. Matching lookups are read-only + hospital-scoped.
 */

export type CreateExternalResultImportData = {
  hospitalId: string;
  source: string;
  externalRef: string;
  patientRef: string;
  orderRef?: string | null;
  modality: string;
  testCode: string;
  resultText: string;
  matchedPatientId?: string | null;
  matchedOrderId?: string | null;
  matchWarning?: string | null;
  status?: ExternalResultStatus;
  importedById?: string | null;
};

export function listExternalResultImports(hospitalId: string, opts: { status?: ExternalResultStatus } = {}) {
  return prisma.externalResultImport.findMany({
    where: { hospitalId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function findExternalResultImportById(hospitalId: string, id: string) {
  return prisma.externalResultImport.findFirst({ where: { id, hospitalId } });
}

export function findExternalResultImportByRef(hospitalId: string, source: string, externalRef: string) {
  return prisma.externalResultImport.findUnique({
    where: { hospitalId_source_externalRef: { hospitalId, source, externalRef } },
  });
}

export function createExternalResultImport(data: CreateExternalResultImportData) {
  return prisma.externalResultImport.create({ data });
}

/**
 * Guarded review transition: only a NEEDS_REVIEW record can be decided (PROMOTED / REJECTED). Returns
 * the update count so the caller can detect a concurrent double-review (count 0 → already decided).
 */
export async function decideExternalResultImport(
  hospitalId: string,
  id: string,
  data: {
    status: ExternalResultStatus;
    reviewedById: string;
    reviewReason?: string | null;
    promotedOrderId?: string | null;
  },
): Promise<number> {
  const res = await prisma.externalResultImport.updateMany({
    where: { id, hospitalId, status: "NEEDS_REVIEW" },
    data,
  });
  return res.count;
}

// ---- Matching lookups (read-only; warnings only; never a clinical write) ----

export function findPatientByNumberForImport(hospitalId: string, patientNumber: string) {
  return prisma.patient.findFirst({
    where: { hospitalId, patientNumber },
    select: { id: true, patientNumber: true },
  });
}

export function findDiagnosticOrderByNumberForImport(hospitalId: string, orderNumber: string) {
  return prisma.diagnosticOrder.findFirst({
    where: { hospitalId, orderNumber },
    select: { id: true, orderNumber: true, patientId: true, status: true },
  });
}
