import type { Prisma, ReportExportFormat, ReportKind, ReportRunStatus, ReportRunTrigger } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4F — advanced reporting / analytics data-access (hospital-scoped). Saved report definitions,
 * runs (PENDING → COMPLETED/FAILED via a guarded `updateMany`) and an export registry. Aggregate-only:
 * the run's `resultJson` holds aggregate rows the service has already asserted non-nominative.
 */

// ---- Report definitions ----

export function listReportDefinitions(hospitalId: string) {
  return prisma.reportDefinition.findMany({ where: { hospitalId }, orderBy: { code: "asc" } });
}

export function findReportDefinitionById(hospitalId: string, id: string) {
  return prisma.reportDefinition.findFirst({ where: { id, hospitalId } });
}

export function findReportDefinitionByCode(hospitalId: string, code: string) {
  return prisma.reportDefinition.findFirst({ where: { hospitalId, code } });
}

export function createReportDefinition(data: {
  hospitalId: string;
  code: string;
  name: string;
  description?: string | null;
  kind: ReportKind;
  paramsJson?: Prisma.InputJsonValue;
  schedulePlaceholder?: string | null;
  createdById?: string | null;
}) {
  return prisma.reportDefinition.create({ data });
}

export async function updateReportDefinition(
  hospitalId: string,
  id: string,
  data: { name?: string; description?: string | null; paramsJson?: Prisma.InputJsonValue; schedulePlaceholder?: string | null; isActive?: boolean },
): Promise<number> {
  const res = await prisma.reportDefinition.updateMany({ where: { id, hospitalId }, data });
  return res.count;
}

// ---- Report runs ----

export function listReportRuns(hospitalId: string, opts: { definitionId?: string; take?: number } = {}) {
  return prisma.reportRun.findMany({
    where: { hospitalId, ...(opts.definitionId ? { reportDefinitionId: opts.definitionId } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    include: { definition: { select: { code: true, name: true, kind: true } }, exports: true },
  });
}

export function findReportRunById(hospitalId: string, id: string) {
  return prisma.reportRun.findFirst({
    where: { id, hospitalId },
    include: { definition: { select: { code: true, name: true, kind: true } }, exports: true },
  });
}

export function createReportRun(data: {
  hospitalId: string;
  reportDefinitionId: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  trigger: ReportRunTrigger;
  runById?: string | null;
}) {
  return prisma.reportRun.create({ data });
}

/** Guarded PENDING → COMPLETED/FAILED completion. Returns the update count (0 if not PENDING). */
export async function completeReportRun(
  hospitalId: string,
  id: string,
  data: { status: ReportRunStatus; rowCount: number; resultJson?: Prisma.InputJsonValue; errorMessage?: string | null; completedAt: Date },
): Promise<number> {
  const res = await prisma.reportRun.updateMany({ where: { id, hospitalId, status: "PENDING" }, data });
  return res.count;
}

// ---- Export registry ----

export function createReportRunExport(data: {
  hospitalId: string;
  reportRunId: string;
  format: ReportExportFormat;
  rowCount: number;
  exportedById?: string | null;
}) {
  return prisma.reportRunExport.create({ data });
}

export function listReportRunExports(hospitalId: string, take = 50) {
  return prisma.reportRunExport.findMany({ where: { hospitalId }, orderBy: { createdAt: "desc" }, take });
}
