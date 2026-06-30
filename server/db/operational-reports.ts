import { prisma } from "./prisma";

/**
 * Phase 2E — read-only operational-reporting data-access (hospital-scoped, AGGREGATE inputs only).
 *
 * The demographics query uses a least-privilege `select`: it returns ONLY the fields needed to compute
 * age/gender bands and diagnosis tallies (date of birth / estimated age / sex + diagnosis code/label) —
 * never a patient name, number, phone or identifier. The DOB is used transiently to derive the age band
 * in the service and is never emitted in any report or export.
 */

export type CreateReportExportData = {
  hospitalId: string;
  kind: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  rowCount: number;
  exportedById: string;
};

export function listConsultationDemographicsForPeriod(
  hospitalId: string,
  start: Date,
  endExclusive: Date,
) {
  return prisma.consultation.findMany({
    where: { hospitalId, createdAt: { gte: start, lt: endExclusive } },
    select: {
      id: true,
      encounter: {
        select: {
          patient: {
            select: { dateOfBirth: true, sex: true, estimatedAge: true, isEstimatedAge: true },
          },
        },
      },
      diagnoses: { where: { deletedAt: null }, select: { code: true, label: true, isPrimary: true } },
    },
  });
}

export function listRecordedPaymentsForPeriod(hospitalId: string, start: Date, endExclusive: Date) {
  return prisma.payment.findMany({
    where: { hospitalId, status: "recorded", createdAt: { gte: start, lt: endExclusive } },
    select: { amount: true, method: true },
  });
}

export function createReportExport(data: CreateReportExportData) {
  return prisma.reportExport.create({ data });
}

export function listReportExports(hospitalId: string, take = 20) {
  return prisma.reportExport.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    take,
    include: { exportedBy: { select: { displayName: true } } },
  });
}
