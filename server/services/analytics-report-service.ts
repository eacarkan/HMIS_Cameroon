import type { ReportKind } from "@prisma/client";

import {
  completeReportRun,
  createReportDefinition,
  createReportRun,
  createReportRunExport,
  findReportDefinitionByCode,
  findReportDefinitionById,
  findReportRunById,
  listReportDefinitions,
  listReportRunExports,
  listReportRuns,
  updateReportDefinition,
  type HospitalContext,
} from "@/server/db";
import {
  type AggregateRow,
  type ReportExportFormatCode,
  type ReportTriggerCode,
  analyticsRowsToCsv,
  assertAggregateReportRows,
  buildAnalyticsRows,
  isReportKind,
  resolveTopN,
  validateReportDefinitionInput,
} from "@/lib/analytics";
import { monthPeriod } from "@/lib/reporting";
import { AuthorizationError, canAtHospital } from "@/server/authz";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { getOperationalReport } from "./operational-report-service";

/**
 * Phase 4F — advanced reporting / analytics service. Saved report definitions (`analytics.report.manage`)
 * + on-demand / scheduled-PLACEHOLDER runs + export registry. AGGREGATE-ONLY: a run reuses the existing
 * Phase 2E aggregate operational report (no nominative field), transforms it into aggregate rows, and
 * asserts non-nominative BEFORE storing/exporting. No AI/ML. No patient-level central disclosure —
 * hospital-scoped; never reads cross-hospital operational data. Audited.
 */

export async function getAnalyticsAdmin(actor: AuthenticatedActor, ctx: HospitalContext) {
  const canView = canAtHospital(actor.rolesByHospital, ctx.hospitalId, "analytics.report.view");
  const canManage = canAtHospital(actor.rolesByHospital, ctx.hospitalId, "analytics.report.manage");
  if (!canView && !canManage) throw new AuthorizationError("analytics.report.view");
  return {
    definitions: await listReportDefinitions(ctx.hospitalId),
    runs: await listReportRuns(ctx.hospitalId),
    exports: await listReportRunExports(ctx.hospitalId),
    canManage,
  };
}

// ---- Definitions ----

export async function createReportDefinitionForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; kind: string; description?: string | null; topN?: number | null; schedulePlaceholder?: string | null },
) {
  await requireCapability(actor, ctx, "analytics.report.manage", { type: "ReportDefinition" });
  const check = validateReportDefinitionInput(input);
  if (!check.ok) throw new Error(check.error);
  const code = input.code.trim().toUpperCase();
  if (await findReportDefinitionByCode(ctx.hospitalId, code)) {
    throw new Error("Un rapport avec ce code existe déjà dans cet hôpital.");
  }
  const def = await createReportDefinition({
    hospitalId: ctx.hospitalId,
    code,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    kind: input.kind as ReportKind,
    paramsJson: { topN: resolveTopN(input.topN) },
    schedulePlaceholder: input.schedulePlaceholder?.trim() || null,
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.analyticsDefinitionCreated,
    entityType: "ReportDefinition", entityId: def.id, summary: `Définition de rapport ${code} (${def.kind}) créée`,
  });
  return def;
}

export async function setReportDefinitionActiveForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  isActive: boolean,
) {
  await requireCapability(actor, ctx, "analytics.report.manage", { type: "ReportDefinition", id });
  const def = await findReportDefinitionById(ctx.hospitalId, id);
  if (!def) throw new Error("Définition introuvable dans cet hôpital.");
  await updateReportDefinition(ctx.hospitalId, id, { isActive });
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.analyticsDefinitionUpdated,
    entityType: "ReportDefinition", entityId: id, summary: `Définition ${def.code} ${isActive ? "activée" : "désactivée"}`,
  });
  return findReportDefinitionById(ctx.hospitalId, id);
}

// ---- Runs ----

export async function runReportForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { definitionId: string; year: number; month: number; trigger?: ReportTriggerCode },
) {
  await requireCapability(actor, ctx, "analytics.report.manage", { type: "ReportRun" });
  const def = await findReportDefinitionById(ctx.hospitalId, input.definitionId);
  if (!def) throw new Error("Définition introuvable dans cet hôpital.");
  if (!def.isActive) throw new Error("Cette définition est désactivée.");
  if (!isReportKind(def.kind)) throw new Error("Type de rapport non pris en charge.");

  const { start, endExclusive, label } = monthPeriod(input.year, input.month);
  const run = await createReportRun({
    hospitalId: ctx.hospitalId, reportDefinitionId: def.id, periodLabel: label,
    periodStart: start, periodEnd: endExclusive, trigger: input.trigger ?? "ON_DEMAND", runById: actor.id,
  });

  try {
    // Reuse the EXISTING aggregate operational report (enforces report.operational.read; no nominative field).
    const report = await getOperationalReport(actor, ctx, { year: input.year, month: input.month });
    const params = (def.paramsJson ?? {}) as { topN?: number | null };
    const rows = buildAnalyticsRows(def.kind, report, { topN: params.topN });
    // LAST gate — reject any non-aggregate row before it is persisted.
    const guard = assertAggregateReportRows(rows as unknown as Record<string, unknown>[]);
    if (!guard.ok) throw new Error(guard.error);
    await completeReportRun(ctx.hospitalId, run.id, {
      status: "COMPLETED", rowCount: rows.length, resultJson: rows, completedAt: new Date(),
    });
    await recordAudit({
      hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.analyticsReportRun,
      entityType: "ReportRun", entityId: run.id,
      summary: `Rapport ${def.code} exécuté (${input.trigger ?? "ON_DEMAND"}) — période ${label}, ${rows.length} lignes agrégées`,
    });
  } catch (err) {
    await completeReportRun(ctx.hospitalId, run.id, {
      status: "FAILED", rowCount: 0, errorMessage: err instanceof Error ? err.message : "échec", completedAt: new Date(),
    });
    throw err;
  }
  return findReportRunById(ctx.hospitalId, run.id);
}

// ---- Export registry ----

export async function exportReportRunForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { runId: string; format: ReportExportFormatCode },
): Promise<{ content: string; filename: string; format: ReportExportFormatCode; rowCount: number }> {
  await requireCapability(actor, ctx, "analytics.report.manage", { type: "ReportRunExport", id: input.runId });
  const run = await findReportRunById(ctx.hospitalId, input.runId);
  if (!run) throw new Error("Exécution introuvable dans cet hôpital.");
  if (run.status !== "COMPLETED") throw new Error("Seule une exécution terminée peut être exportée.");

  const rows = (run.resultJson ?? []) as AggregateRow[];
  // Re-assert aggregate-only at export time (belt-and-suspenders).
  const guard = assertAggregateReportRows(rows as unknown as Record<string, unknown>[]);
  if (!guard.ok) throw new Error(guard.error);

  const content = input.format === "CSV" ? analyticsRowsToCsv(rows) : JSON.stringify(rows, null, 2);
  const filename = `${run.definition.code}-${run.periodLabel}.${input.format.toLowerCase()}`;
  await createReportRunExport({
    hospitalId: ctx.hospitalId, reportRunId: run.id, format: input.format, rowCount: rows.length, exportedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.analyticsReportExported,
    entityType: "ReportRunExport", entityId: run.id,
    summary: `Rapport ${run.definition.code} exporté (${input.format}, ${rows.length} lignes agrégées) — ${run.periodLabel}`,
  });
  return { content, filename, format: input.format, rowCount: rows.length };
}
