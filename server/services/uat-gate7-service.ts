import type { SiteReadinessStatus } from "@prisma/client";

import {
  type Gate7ReadinessSignal,
  type UatStatus,
  type UatSummary,
  GATE7_CRITERIA,
  GATE7_DISCLAIMER_EN,
  GATE7_DISCLAIMER_FR,
  UAT_SCENARIO_LIBRARY,
  UAT_STATUSES,
  computeGate7Signal,
  summarizeUat,
} from "@/lib/uat-gate7";
import {
  type HospitalContext,
  countUatScenarios,
  findUatScenarioByCode,
  listGate7Items,
  listUatScenariosWithExecutions,
  upsertGate7Item,
  upsertUatExecution,
  upsertUatScenario,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * UAT evidence + Gate 7 readiness service (Phase 3E). EVIDENCE ONLY — never an authorization. Reads
 * merge the fixed UAT scenario library + Gate 7 criteria with the hospital's stored records. Updates
 * are RBAC-checked, hospital-scoped, audited; sign-off fields are PLACEHOLDERS (no legal e-signature).
 */

/** Ensure the hospital's UAT scenario library exists (idempotent); audit once when first established. */
async function ensureScenarioLibrary(actor: AuthenticatedActor, ctx: HospitalContext) {
  const existing = await countUatScenarios(ctx.hospitalId);
  for (const s of UAT_SCENARIO_LIBRARY) {
    await upsertUatScenario(ctx.hospitalId, s.code, {
      category: s.category,
      titleFr: s.titleFr,
      titleEn: s.titleEn,
      expectedResult: s.expectedResult,
    });
  }
  if (existing === 0) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.uatScenarioCreated,
      entityType: "UatScenario",
      entityId: null,
      summary: `Bibliothèque UAT initialisée (${UAT_SCENARIO_LIBRARY.length} scénarios) pour ${ctx.code}`,
    });
  }
}

export type UatScenarioView = {
  code: string;
  category: string;
  titleFr: string;
  titleEn: string | null;
  expectedResult: string | null;
  status: UatStatus;
  notes: string | null;
};

export type Gate7ItemView = {
  criterion: string;
  labelFr: string;
  labelEn: string;
  status: SiteReadinessStatus;
  note: string | null;
  directorSignoffPlaceholder: string | null;
  minsanteSignoffPlaceholder: string | null;
};

export type UatEvidenceView = {
  scenarios: UatScenarioView[];
  uat: UatSummary;
  gate7: Gate7ItemView[];
  signal: Gate7ReadinessSignal;
  /** The mandatory "evidence only — not authorization" disclaimer (both locales). */
  disclaimerFr: string;
  disclaimerEn: string;
};

/** The full UAT + Gate 7 readiness evidence for the active hospital (read-only; `uat.view`). */
export async function getUatEvidence(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<UatEvidenceView> {
  await requireCapability(actor, ctx, "uat.view");
  await ensureScenarioLibrary(actor, ctx);

  const scenarioRows = await listUatScenariosWithExecutions(ctx.hospitalId);
  const scenarios: UatScenarioView[] = scenarioRows.map((s) => ({
    code: s.code,
    category: s.category,
    titleFr: s.titleFr,
    titleEn: s.titleEn,
    expectedResult: s.expectedResult,
    status: (s.executions[0]?.status ?? "not_run") as UatStatus,
    notes: s.executions[0]?.notes ?? null,
  }));
  const uat = summarizeUat(scenarios.map((s) => s.status));

  const storedGate7 = await listGate7Items(ctx.hospitalId);
  const byCriterion = new Map(storedGate7.map((g) => [g.criterion, g]));
  const gate7: Gate7ItemView[] = GATE7_CRITERIA.map((c) => {
    const row = byCriterion.get(c.key);
    return {
      criterion: c.key,
      labelFr: c.labelFr,
      labelEn: c.labelEn,
      status: (row?.status ?? "not_started") as SiteReadinessStatus,
      note: row?.note ?? null,
      directorSignoffPlaceholder: row?.directorSignoffPlaceholder ?? null,
      minsanteSignoffPlaceholder: row?.minsanteSignoffPlaceholder ?? null,
    };
  });

  const signal = computeGate7Signal(uat, gate7.map((g) => g.status));
  return { scenarios, uat, gate7, signal, disclaimerFr: GATE7_DISCLAIMER_FR, disclaimerEn: GATE7_DISCLAIMER_EN };
}

/** Record a UAT scenario execution result (`uat.manage`); audited. */
export async function recordUatExecution(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  scenarioCode: string,
  input: { status: UatStatus; notes?: string | null },
) {
  await requireCapability(actor, ctx, "uat.manage", { type: "UatExecution", id: scenarioCode });
  if (!UAT_STATUSES.includes(input.status)) throw new Error("Statut UAT invalide.");
  await ensureScenarioLibrary(actor, ctx);
  const scenario = await findUatScenarioByCode(ctx.hospitalId, scenarioCode);
  if (!scenario) throw new Error("Scénario UAT introuvable dans cet hôpital.");
  const execution = await upsertUatExecution(ctx.hospitalId, scenario.id, {
    status: input.status,
    notes: input.notes?.trim() || null,
    executedById: actor.id,
    executedAt: new Date(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.uatExecutionRecorded,
    entityType: "UatExecution",
    entityId: execution.id,
    summary: `UAT « ${scenarioCode} » → ${input.status}`,
  });
  return execution;
}

/** Update a Gate 7 criterion status/note (`uat.manage`); audited. */
export async function setGate7Item(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  criterion: string,
  input: { status: SiteReadinessStatus; note?: string | null },
) {
  await requireCapability(actor, ctx, "uat.manage", { type: "Gate7ReadinessItem", id: criterion });
  if (!GATE7_CRITERIA.some((c) => c.key === criterion)) throw new Error("Critère Gate 7 inconnu.");
  const item = await upsertGate7Item(ctx.hospitalId, criterion, { status: input.status, note: input.note?.trim() || null });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.gate7ItemUpdated,
    entityType: "Gate7ReadinessItem",
    entityId: item.id,
    summary: `Critère Gate 7 « ${criterion} » → ${input.status}`,
  });
  return item;
}

/** Set the Director / MINSANTE sign-off PLACEHOLDERS for a Gate 7 criterion (`uat.signoff_placeholder`). */
export async function setGate7Signoff(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  criterion: string,
  input: { directorSignoffPlaceholder?: string | null; minsanteSignoffPlaceholder?: string | null },
) {
  await requireCapability(actor, ctx, "uat.signoff_placeholder", { type: "Gate7ReadinessItem", id: criterion });
  if (!GATE7_CRITERIA.some((c) => c.key === criterion)) throw new Error("Critère Gate 7 inconnu.");
  const item = await upsertGate7Item(ctx.hospitalId, criterion, {
    directorSignoffPlaceholder: input.directorSignoffPlaceholder?.trim() || null,
    minsanteSignoffPlaceholder: input.minsanteSignoffPlaceholder?.trim() || null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.gate7SignoffPlaceholderChanged,
    entityType: "Gate7ReadinessItem",
    entityId: item.id,
    summary: `Signature (placeholder) mise à jour pour le critère Gate 7 « ${criterion} »`,
  });
  return item;
}
