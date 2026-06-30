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
