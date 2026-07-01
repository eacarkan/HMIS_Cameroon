import {
  createDhis2MappingSet,
  createReportExport,
  findDhis2MappingSetByCode,
  findDhis2MappingSetById,
  listDhis2MappingSets,
  upsertDhis2Mapping,
  type HospitalContext,
} from "@/server/db";
import { buildDhis2Csv } from "@/lib/dhis2";
import {
  assertAggregateOnly,
  classifyExportRows,
  validateMappingInput,
  validateMappingSetInput,
} from "@/lib/dhis2-mapping";
import { isLiveIntegrationEnabled, resolveConnectorAdapter } from "@/lib/integration";
import { monthPeriod } from "@/lib/reporting";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { buildDhis2RowsForPeriod } from "./operational-report-service";

/**
 * DHIS2 configurable export / API-readiness service (Phase 4B). Manage per-hospital DHIS2 mapping sets
 * (org-unit / data-element / category-option-combo PLACEHOLDERS — non-secret, non-final), VALIDATE the
 * aggregate rows against the mapping BEFORE any export, produce the (preserved) manual CSV, and run an
 * OPTIONAL mock API export through the 4A mock connector (NO network). Aggregate-only — an
 * `assertAggregateOnly` guard rejects any non-aggregate field. Hospital-scoped, RBAC-enforced, audited.
 * No real DHIS2 credentials; no real API call; no hard-coded Ministry codes.
 */

export async function getDhis2MappingAdmin(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "dhis2.mapping.manage");
  return { mappingSets: await listDhis2MappingSets(ctx.hospitalId), liveEnabled: isLiveIntegrationEnabled() };
}

export async function createDhis2MappingSetForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; orgUnitPlaceholder?: string },
) {
  await requireCapability(actor, ctx, "dhis2.mapping.manage", { type: "Dhis2MappingSet" });
  const check = validateMappingSetInput(input);
  if (!check.ok) throw new Error(check.error);
  const code = input.code.trim().toUpperCase();
  if (await findDhis2MappingSetByCode(ctx.hospitalId, code)) {
    throw new Error("Un jeu de correspondances avec ce code existe déjà dans cet hôpital.");
  }
  const set = await createDhis2MappingSet({
    hospitalId: ctx.hospitalId,
    code,
    name: input.name.trim(),
    orgUnitPlaceholder: input.orgUnitPlaceholder?.trim() || "",
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.dhis2MappingUpdated,
    entityType: "Dhis2MappingSet",
    entityId: set.id,
    summary: `Jeu de correspondances DHIS2 créé : ${code} (placeholders uniquement)`,
  });
  return set;
}

export async function upsertDhis2MappingForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: {
    mappingSetId: string;
    localElement: string;
    dataElementPlaceholder: string;
    categoryOptionComboPlaceholder?: string | null;
  },
) {
  await requireCapability(actor, ctx, "dhis2.mapping.manage", { type: "Dhis2Mapping" });
  const check = validateMappingInput(input);
  if (!check.ok) throw new Error(check.error);
  const set = await findDhis2MappingSetById(ctx.hospitalId, input.mappingSetId);
  if (!set) throw new Error("Jeu de correspondances introuvable dans cet hôpital.");
  const mapping = await upsertDhis2Mapping({
    hospitalId: ctx.hospitalId,
    mappingSetId: set.id,
    localElement: input.localElement.trim(),
    dataElementPlaceholder: input.dataElementPlaceholder.trim(),
    categoryOptionComboPlaceholder: input.categoryOptionComboPlaceholder?.trim() || null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.dhis2MappingUpdated,
    entityType: "Dhis2Mapping",
    entityId: mapping.id,
    summary: `Correspondance DHIS2 « ${mapping.localElement} » → ${mapping.dataElementPlaceholder} (placeholder) pour ${set.code}`,
  });
  return mapping;
}

async function buildValidatedRows(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { mappingSetId: string; year: number; month: number },
) {
  await requireCapability(actor, ctx, "dhis2.export.run", { type: "Dhis2MappingSet", id: input.mappingSetId });
  const set = await findDhis2MappingSetById(ctx.hospitalId, input.mappingSetId);
  if (!set) throw new Error("Jeu de correspondances introuvable dans cet hôpital.");
  const { rows, periodLabel } = await buildDhis2RowsForPeriod(ctx, input);
  const classification = classifyExportRows(rows, set.mappings);
  return { set, rows, periodLabel, classification };
}

/** VALIDATE BEFORE EXPORT — which data elements are mapped/unmapped for the period (no export yet). */
export async function getDhis2ExportReadiness(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { mappingSetId: string; year: number; month: number },
) {
  const { rows, periodLabel, classification } = await buildValidatedRows(actor, ctx, input);
  return { periodLabel, rowCount: rows.length, ...classification };
}

function assertReadyAndAggregate(rows: { dataElement: string }[], classification: { ready: boolean; unmapped: string[] }) {
  if (!classification.ready) {
    throw new Error(
      `Export refusé — éléments non mappés : ${classification.unmapped.join(", ")}. Complétez les correspondances DHIS2.`,
    );
  }
  const agg = assertAggregateOnly(rows as unknown as Record<string, unknown>[]);
  if (!agg.ok) throw new Error(agg.error);
}

/** Manual DHIS2-aligned CSV (Phase 2E format), gated on a COMPLETE mapping. Aggregate-only; audited. */
export async function exportDhis2MappedCsv(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { mappingSetId: string; year: number; month: number },
) {
  const { set, rows, periodLabel, classification } = await buildValidatedRows(actor, ctx, input);
  assertReadyAndAggregate(rows, classification);
  const { csv, rowCount } = buildDhis2Csv(rows);
  const { start, endExclusive } = monthPeriod(input.year, input.month);
  await createReportExport({
    hospitalId: ctx.hospitalId,
    kind: "dhis2_mapped_csv",
    periodLabel,
    periodStart: start,
    periodEnd: endExclusive,
    rowCount,
    exportedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.dhis2ExportCsv,
    entityType: "Dhis2MappingSet",
    entityId: set.id,
    summary: `Export CSV DHIS2 (mappé ${set.code}) — période ${periodLabel}, ${rowCount} ligne(s) agrégée(s), aucun identifiant`,
  });
  return { csv, rowCount, periodLabel };
}

/** OPTIONAL mock API export — runs through the 4A MOCK connector (NO network). Aggregate-only; audited. */
export async function runDhis2MockApiExport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { mappingSetId: string; year: number; month: number },
) {
  const { set, rows, periodLabel, classification } = await buildValidatedRows(actor, ctx, input);
  assertReadyAndAggregate(rows, classification);
  const { rowCount } = buildDhis2Csv(rows);
  // The mock connector performs NO network request (egress guard). Live mode is off by default.
  const adapter = resolveConnectorAdapter("MOCK", { liveEnabled: isLiveIntegrationEnabled() });
  const result = await adapter.run({
    jobKind: "DHIS2_EXPORT",
    payload: { period: periodLabel, orgUnit: set.orgUnitPlaceholder, rowCount },
  });
  const { start, endExclusive } = monthPeriod(input.year, input.month);
  await createReportExport({
    hospitalId: ctx.hospitalId,
    kind: "dhis2_mock_api",
    periodLabel,
    periodStart: start,
    periodEnd: endExclusive,
    rowCount,
    exportedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.dhis2ExportMockApi,
    entityType: "Dhis2MappingSet",
    entityId: set.id,
    summary: `Export API DHIS2 FICTIF (${set.code}) — période ${periodLabel}, ${rowCount} ligne(s) agrégée(s), aucun appel réseau`,
  });
  return { ok: result.ok, detail: result.detail, rowCount, periodLabel };
}
