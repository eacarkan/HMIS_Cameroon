import { monthPeriod } from "@/lib/reporting";
import { AuthorizationError, can } from "@/server/authz";
import {
  type HospitalContext,
  gatherSnapshotCounts,
  listActiveDiagnosisCodes,
  listLatestHospitalSnapshots,
  upsertHospitalAggregateSnapshot,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { getOperationalReport } from "./operational-report-service";

/**
 * Central oversight service (Phase 3B/3D). Exposes the ONLY cross-hospital read in the system, and
 * it is strictly AGGREGATE + READ-ONLY + SNAPSHOT-FED: the central viewer reads ONLY stored
 * `HospitalAggregateSnapshot` rows (+ hospital identity), NEVER operational patient/encounter/
 * invoice/lab/pharmacy tables. `central.aggregate.view` is a GLOBAL capability (not bound to one
 * hospital), so it is checked against the actor's full role set — the deliberate exception to
 * per-hospital authorization. Every access is audited (`central.aggregate.accessed`). Snapshots are
 * produced hospital-side by `generateHospitalAggregateSnapshot` (gated by `report.operational.read`).
 *
 * NOTE (Phase 3 QA patch): the former live path `getCentralAggregates` — which queried the
 * operational tables directly across all hospitals — was REMOVED. There is no central-accessible
 * service that reads operational tables; central oversight is snapshot-fed only.
 */

// ---- Snapshot-fed central oversight (the central viewer reads ONLY aggregate snapshots) ----

/** Aggregate-only snapshot payload. Counts/totals + top-ICD-diagnosis COUNTS — no nominative field. */
export type SnapshotIndicators = {
  period: string;
  periodLabel: string;
  consultationCount: number;
  patientCount: number;
  queueTicketCount: number;
  admissionCount: number;
  diagnosticOrderCount: number;
  revenueTotalFcfa: number;
  revenueByMethod: { method: string; amount: number }[];
  topDiagnoses: { code: string; label: string; count: number }[];
  emergencyDebtOutstandingFcfa: number;
  pharmacy: { medicationsTracked: number; lowStock: number; expiringLots: number } | null;
};

/**
 * Generate/refresh ONE hospital's aggregate snapshot for a period (default: current month). This is
 * a HOSPITAL-SIDE action — it reads the hospital's own operational data in aggregate (reusing the 2E
 * operational report, gated by `report.operational.read`) and stores ONLY aggregate counts/totals.
 * Audited `central.snapshot.generated`. Never stores a nominative field.
 */
export async function generateHospitalAggregateSnapshot(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input?: { year: number; month: number },
) {
  const now = new Date();
  const year = input?.year ?? now.getUTCFullYear();
  const month = input?.month ?? now.getUTCMonth() + 1;
  // getOperationalReport enforces `report.operational.read` (hospital-scoped) — the generation gate.
  const report = await getOperationalReport(actor, ctx, { year, month });
  const { start, endExclusive } = monthPeriod(year, month);
  const counts = await gatherSnapshotCounts(ctx.hospitalId, start, endExclusive);
  const period = `${year}-${String(month).padStart(2, "0")}`;

  // PRIVACY (3D review fix): the diagnosis `label` is a free-text clinical field, so it must never
  // cross the hospital boundary verbatim. Keep ONLY valid ICD-10-coded diagnoses and emit the
  // canonical REFERENCE label (never the clinician's free text) — mirroring the DHIS2 export guard.
  const refLabelByCode = new Map(
    (await listActiveDiagnosisCodes()).map((c) => [c.code, c.labelFr]),
  );
  const safeTopDiagnoses = report.diagnoses
    .filter((d) => refLabelByCode.has(d.code))
    .map((d) => ({ code: d.code, label: refLabelByCode.get(d.code) as string, count: d.count }));

  const indicators: SnapshotIndicators = {
    period,
    periodLabel: report.periodLabel,
    consultationCount: report.consultationCount,
    patientCount: counts.patientCount,
    queueTicketCount: counts.queueTicketCount,
    admissionCount: counts.admissionCount,
    diagnosticOrderCount: counts.diagnosticOrderCount,
    revenueTotalFcfa: report.revenueTotal,
    revenueByMethod: report.revenueByMethod,
    topDiagnoses: safeTopDiagnoses,
    emergencyDebtOutstandingFcfa: counts.emergencyDebtOutstandingFcfa,
    pharmacy: report.pharmacy
      ? {
          medicationsTracked: report.pharmacy.medicationsTracked,
          lowStock: report.pharmacy.low,
          expiringLots: report.pharmacy.expiring,
        }
      : null,
  };

  const snapshot = await upsertHospitalAggregateSnapshot({
    hospitalId: ctx.hospitalId,
    period,
    indicators: indicators as unknown as Record<string, unknown>,
    generatedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.centralSnapshotGenerated,
    entityType: "HospitalAggregateSnapshot",
    entityId: snapshot.id,
    summary: `Instantané agrégé généré pour ${ctx.code} (${period}) — agrégats uniquement`,
  });
  return snapshot;
}

export type CentralOversightHospital = {
  hospitalId: string;
  code: string;
  name: string;
  region: string;
  isActive: boolean;
  period: string;
  generatedAt: Date;
  indicators: SnapshotIndicators;
};

/**
 * Snapshot-fed central oversight (read-only, aggregate-only). Reads ONLY the latest
 * HospitalAggregateSnapshot per hospital (+ that snapshot's hospital identity) — it NEVER queries
 * operational patient/encounter/invoice/lab/pharmacy tables. Requires `central.aggregate.view`
 * (global); audited `central.aggregate.accessed`.
 */
export async function getCentralOversight(
  actor: AuthenticatedActor,
): Promise<{ hospitals: CentralOversightHospital[] }> {
  if (!can(actor.roles, "central.aggregate.view")) {
    await recordAudit({
      hospitalId: null,
      actorId: actor.id,
      action: AUDIT_ACTIONS.authzDenied,
      entityType: "central.aggregate.view",
      entityId: null,
      summary: "Accès à l'oversight central refusé — rôle non autorisé",
    });
    throw new AuthorizationError("central.aggregate.view");
  }

  const snapshots = await listLatestHospitalSnapshots();
  const hospitals: CentralOversightHospital[] = snapshots.map((s) => ({
    hospitalId: s.hospitalId,
    code: s.hospital.code,
    name: s.hospital.name,
    region: s.hospital.region,
    isActive: s.hospital.isActive,
    period: s.period,
    generatedAt: s.createdAt,
    indicators: s.indicators as unknown as SnapshotIndicators,
  }));

  await recordAudit({
    hospitalId: null,
    actorId: actor.id,
    action: AUDIT_ACTIONS.centralAggregateAccessed,
    entityType: "CentralOversight",
    entityId: null,
    summary: `Consultation de l'oversight central (instantanés) — ${hospitals.length} hôpital(aux), agrégats uniquement`,
  });
  return { hospitals };
}
