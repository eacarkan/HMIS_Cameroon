import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Central oversight data access (Phase 3B). The ONE deliberately cross-hospital read path —
 * and it is strictly AGGREGATE: per-hospital COUNTS and a payment TOTAL only. It performs no
 * patient-level query and returns no nominative field (no name / number / phone / DOB / diagnosis).
 * Consumers: the central-oversight service (which gates on `central.aggregate.view` + audits).
 * Patient-level central access is out of scope (and forbidden) — there is no function here for it.
 */

export type CentralHospitalAggregate = {
  hospitalId: string;
  code: string;
  name: string;
  region: string;
  isActive: boolean;
  patientCount: number;
  encounterCount: number;
  invoiceCount: number;
  /** Sum of recorded payments, integer FCFA. */
  paidTotalFcfa: number;
};

/** Per-hospital aggregate counts across ALL hospitals (no patient-level data). */
export async function gatherCentralAggregates(): Promise<CentralHospitalAggregate[]> {
  const [hospitals, patients, encounters, invoices, payments] = await Promise.all([
    prisma.hospital.findMany({ orderBy: { code: "asc" } }),
    prisma.patient.groupBy({ by: ["hospitalId"], _count: { _all: true } }),
    prisma.encounter.groupBy({ by: ["hospitalId"], _count: { _all: true } }),
    prisma.invoice.groupBy({ by: ["hospitalId"], _count: { _all: true } }),
    prisma.payment.groupBy({
      by: ["hospitalId"],
      where: { status: "recorded" },
      _sum: { amount: true },
    }),
  ]);

  const patientByHospital = new Map(patients.map((p) => [p.hospitalId, p._count._all]));
  const encounterByHospital = new Map(encounters.map((e) => [e.hospitalId, e._count._all]));
  const invoiceByHospital = new Map(invoices.map((i) => [i.hospitalId, i._count._all]));
  const paidByHospital = new Map(payments.map((p) => [p.hospitalId, p._sum.amount ?? 0]));

  return hospitals.map((h) => ({
    hospitalId: h.id,
    code: h.code,
    name: h.name,
    region: h.region,
    isActive: h.isActive,
    patientCount: patientByHospital.get(h.id) ?? 0,
    encounterCount: encounterByHospital.get(h.id) ?? 0,
    invoiceCount: invoiceByHospital.get(h.id) ?? 0,
    paidTotalFcfa: paidByHospital.get(h.id) ?? 0,
  }));
}

// ---- Phase 3D — aggregate snapshots (the ONLY thing the central viewer reads) ----

/**
 * Hospital-scoped aggregate counts for a snapshot period (used ONLY at GENERATION time, on the
 * hospital side). Counts/sums only — no nominative selection. The central read path never calls
 * this; it reads the stored snapshots.
 */
export async function gatherSnapshotCounts(
  hospitalId: string,
  start: Date,
  endExclusive: Date,
): Promise<{
  patientCount: number;
  queueTicketCount: number;
  admissionCount: number;
  diagnosticOrderCount: number;
  emergencyDebtOutstandingFcfa: number;
}> {
  const [patientCount, queueTicketCount, admissionCount, diagnosticOrderCount, emergencyDebt] =
    await Promise.all([
      prisma.patient.count({ where: { hospitalId, createdAt: { gte: start, lt: endExclusive } } }),
      prisma.queueTicket.count({ where: { hospitalId, createdAt: { gte: start, lt: endExclusive } } }),
      prisma.admission.count({ where: { hospitalId, createdAt: { gte: start, lt: endExclusive } } }),
      prisma.diagnosticOrder.count({ where: { hospitalId, createdAt: { gte: start, lt: endExclusive } } }),
      prisma.emergencyDebt.aggregate({
        where: { hospitalId, status: "outstanding" },
        _sum: { amount: true },
      }),
    ]);
  return {
    patientCount,
    queueTicketCount,
    admissionCount,
    diagnosticOrderCount,
    emergencyDebtOutstandingFcfa: emergencyDebt._sum.amount ?? 0,
  };
}

/** Upsert one hospital's aggregate snapshot for a period (aggregate-only payload). Hospital-scoped. */
export function upsertHospitalAggregateSnapshot(params: {
  hospitalId: string;
  period: string;
  indicators: Record<string, unknown>;
  generatedById: string;
}) {
  const { hospitalId, period, generatedById } = params;
  const indicators = params.indicators as Prisma.InputJsonValue;
  return prisma.hospitalAggregateSnapshot.upsert({
    where: { hospitalId_period: { hospitalId, period } },
    create: { hospitalId, period, indicators, generatedById },
    update: { indicators, generatedById },
  });
}

/**
 * The latest snapshot per hospital, joined with hospital identity (code/name/region) — the SOLE
 * data source for the central oversight view. Reads ONLY the snapshot + Hospital metadata; it never
 * touches patient/encounter/invoice/lab/pharmacy operational tables.
 */
export async function listLatestHospitalSnapshots() {
  const snapshots = await prisma.hospitalAggregateSnapshot.findMany({
    orderBy: [{ hospitalId: "asc" }, { period: "desc" }],
    include: { hospital: { select: { code: true, name: true, region: true, isActive: true } } },
  });
  // Keep the most recent period per hospital (the list is sorted period-desc within hospital).
  const seen = new Set<string>();
  const latest: typeof snapshots = [];
  for (const s of snapshots) {
    if (seen.has(s.hospitalId)) continue;
    seen.add(s.hospitalId);
    latest.push(s);
  }
  return latest;
}
