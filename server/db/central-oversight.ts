import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Central oversight data access (Phase 3B/3D). The central viewer's SOLE data source is the stored
 * aggregate snapshot (`listLatestHospitalSnapshots`) + hospital identity metadata — it performs no
 * patient-level query and returns no nominative field (no name / number / phone / DOB / diagnosis).
 * `gatherSnapshotCounts` / `upsertHospitalAggregateSnapshot` run hospital-side at GENERATION time
 * only. Patient-level central access is out of scope (and forbidden) — there is no function for it.
 *
 * NOTE (Phase 3 QA patch): the former live cross-hospital path `gatherCentralAggregates` — which
 * read the operational `patient`/`encounter`/`invoice`/`payment` tables directly — was REMOVED.
 * Nothing on the central read path queries operational tables; it reads only stored snapshots.
 */

// ---- Aggregate snapshots (the ONLY thing the central viewer reads) ----

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
