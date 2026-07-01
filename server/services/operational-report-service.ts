import {
  createReportExport,
  listActiveDiagnosisCodes,
  listConsultationDemographicsForPeriod,
  listRecordedPaymentsForPeriod,
  listReportExports,
  type HospitalContext,
} from "@/server/db";
import { AGE_BANDS, ageBand, buildDhis2Csv, genderCode, patientAgeYears, type Dhis2Row } from "@/lib/dhis2";
import { monthPeriod, topDiagnoses } from "@/lib/reporting";
import { sumFcfa } from "@/lib/money";
import { canAtHospital } from "@/lib/rbac";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { getPharmacyReport } from "./pharmacy-report-service";

/**
 * Operational reporting service (Phase 2E). READ-ONLY, hospital-scoped, AGGREGATE-only reports + the
 * DHIS2-aligned manual CSV export. The export contains period / org-unit / data-element / age-band /
 * gender / count rows ONLY — NO nominative patient data (the DHIS2 direct API is deferred to Phase 4).
 * Demographics (DOB / estimated age / sex) are read solely to compute age/gender bands and are never
 * emitted; only the band counts leave the service.
 */

type ConsultationRow = Awaited<ReturnType<typeof listConsultationDemographicsForPeriod>>[number];

function ageGenderTally(consultations: ConsultationRow[], asOf: Date) {
  const tally = new Map<string, { M: number; F: number; U: number }>();
  for (const c of consultations) {
    const p = c.encounter.patient;
    const band = ageBand(patientAgeYears(p, asOf));
    const g = genderCode(p.sex);
    const row = tally.get(band) ?? { M: 0, F: 0, U: 0 };
    row[g] += 1;
    tally.set(band, row);
  }
  return tally;
}

export async function getOperationalReport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { year: number; month: number },
) {
  await requireCapability(actor, ctx, "report.operational.read");
  const { start, endExclusive, label } = monthPeriod(input.year, input.month);
  const asOf = new Date(endExclusive.getTime() - 1);

  const consultations = await listConsultationDemographicsForPeriod(ctx.hospitalId, start, endExclusive);
  const payments = await listRecordedPaymentsForPeriod(ctx.hospitalId, start, endExclusive);

  // Age/gender tally (consultations seen).
  const tally = ageGenderTally(consultations, asOf);
  const ageGender = AGE_BANDS.map((b) => {
    const r = tally.get(b.key) ?? { M: 0, F: 0, U: 0 };
    return { band: b.key, M: r.M, F: r.F, U: r.U, total: r.M + r.F + r.U };
  });

  // Top-10 diagnoses (ICD-10 subset).
  const allDiagnoses = consultations.flatMap((c) => c.diagnoses);
  const diagnoses = topDiagnoses(allDiagnoses, 10);

  // Revenue summary (integer FCFA) + by payment method.
  const revenueTotal = sumFcfa(payments.map((p) => p.amount));
  const byMethodMap = new Map<string, number>();
  for (const p of payments) byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + p.amount);
  const revenueByMethod = [...byMethodMap.entries()].map(([method, amount]) => ({ method, amount }));

  // Pharmacy snapshot (only when the viewer may read stock; a current-state complement to the month).
  let pharmacy: { medicationsTracked: number; low: number; expiring: number; dispensedUnits30d: number } | null = null;
  if (canAtHospital(actor.rolesByHospital, ctx.hospitalId, "stock.read")) {
    const pr = await getPharmacyReport(actor, ctx);
    pharmacy = {
      medicationsTracked: pr.stockLevels.length,
      low: pr.lowStock.length,
      expiring: pr.expiringLots.length,
      dispensedUnits30d: pr.dispensing.totalUnits,
    };
  }

  const exportHistory = await listReportExports(ctx.hospitalId);

  return {
    periodLabel: label,
    orgUnit: ctx.code,
    consultationCount: consultations.length,
    diagnosisCount: allDiagnoses.length,
    ageGender,
    diagnoses,
    revenueTotal,
    revenueByMethod,
    pharmacy,
    exportHistory,
  };
}

/**
 * Build the period's DHIS2-aligned aggregate rows (consultations + coded diagnoses per age/gender).
 * Only diagnoses whose code is a VALID ICD-10 reference code (`validCodes`) are exported — a free-typed
 * or malformed code is excluded so the CSV stays cleanly DHIS2-importable.
 */
function buildDhis2Rows(
  consultations: ConsultationRow[],
  orgUnit: string,
  period: string,
  asOf: Date,
  validCodes: Set<string>,
): Dhis2Row[] {
  const consult = new Map<string, number>(); // key band|gender
  const diag = new Map<string, number>(); // key band|gender|code
  for (const c of consultations) {
    const p = c.encounter.patient;
    const band = ageBand(patientAgeYears(p, asOf));
    const gender = genderCode(p.sex);
    consult.set(`${band}|${gender}`, (consult.get(`${band}|${gender}`) ?? 0) + 1);
    for (const d of c.diagnoses) {
      const code = d.code?.trim();
      if (!code || !validCodes.has(code)) continue; // only VALID ICD-10 codes are exported
      diag.set(`${band}|${gender}|${code}`, (diag.get(`${band}|${gender}|${code}`) ?? 0) + 1);
    }
  }
  const rows: Dhis2Row[] = [];
  for (const [k, value] of consult) {
    const [band, gender] = k.split("|");
    rows.push({ period, orgUnit, dataElement: "CONSULTATIONS", ageBand: band as Dhis2Row["ageBand"], gender: gender as Dhis2Row["gender"], value });
  }
  for (const [k, value] of diag) {
    const [band, gender, code] = k.split("|");
    rows.push({ period, orgUnit, dataElement: `DIAG:${code}`, ageBand: band as Dhis2Row["ageBand"], gender: gender as Dhis2Row["gender"], value });
  }
  return rows;
}

/**
 * Phase 4B — the period's DHIS2-aligned AGGREGATE rows (period / org-unit / data-element / age-band /
 * gender / count), reused by the DHIS2 mapping + export-readiness framework. Aggregate-only (no
 * nominative field, only valid ICD-10 diagnosis codes). Additive; no change to the Phase 2E export.
 */
export async function buildDhis2RowsForPeriod(
  ctx: HospitalContext,
  input: { year: number; month: number },
): Promise<{ rows: Dhis2Row[]; periodLabel: string }> {
  const { start, endExclusive, label } = monthPeriod(input.year, input.month);
  const asOf = new Date(endExclusive.getTime() - 1);
  const consultations = await listConsultationDemographicsForPeriod(ctx.hospitalId, start, endExclusive);
  const validCodes = new Set((await listActiveDiagnosisCodes()).map((c) => c.code));
  return { rows: buildDhis2Rows(consultations, ctx.code, label, asOf, validCodes), periodLabel: label };
}

export async function exportDhis2Csv(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { year: number; month: number },
): Promise<{ csv: string; periodLabel: string; rowCount: number }> {
  await requireCapability(actor, ctx, "report.export");
  const { start, endExclusive, label } = monthPeriod(input.year, input.month);
  const asOf = new Date(endExclusive.getTime() - 1);

  const consultations = await listConsultationDemographicsForPeriod(ctx.hospitalId, start, endExclusive);
  const validCodes = new Set((await listActiveDiagnosisCodes()).map((c) => c.code));
  const rows = buildDhis2Rows(consultations, ctx.code, label, asOf, validCodes);
  const { csv, rowCount } = buildDhis2Csv(rows);

  await createReportExport({
    hospitalId: ctx.hospitalId,
    kind: "dhis2_monthly",
    periodLabel: label,
    periodStart: start,
    periodEnd: endExclusive,
    rowCount,
    exportedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.reportExportedCsv,
    entityType: "ReportExport",
    entityId: ctx.hospitalId,
    summary: `Export CSV agrégé DHIS2 — période ${label}, établissement ${ctx.code}, ${rowCount} ligne(s) agrégée(s)`,
  });

  return { csv, periodLabel: label, rowCount };
}
