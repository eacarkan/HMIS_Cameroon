import {
  type ConfigurationTemplateContent,
  validateTemplateContent,
  summarizeTemplateContent,
} from "@/lib/configuration-template";
import {
  type CompletenessResult,
  type HospitalConfigSummary,
  computeCompleteness,
  compareCompleteness,
} from "@/lib/configuration-completeness";
import {
  type HospitalContext,
  listConfigurationTemplates,
  findConfigurationTemplateById,
  createConfigurationTemplate,
  updateConfigurationTemplate,
  listConfigurationTemplateApplications,
  applyTemplateToHospital,
  gatherHospitalConfigSummary,
  upsertSetting,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { getAccessibleHospitals } from "./hospital-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Multi-hospital configuration foundation (Phase 3A). Hospital Admins manage shared,
 * hospital-agnostic configuration TEMPLATES and APPLY them to a specific hospital instance;
 * everyone with `config.view` reads the per-hospital completeness dashboard. Every mutation
 * is server-side RBAC-checked, hospital-scoped (the apply writes only `ctx.hospitalId`'s config
 * rows), and audited. Cross-hospital configuration is impossible: the active context is resolved
 * from the actor's memberships, and the completeness comparison only spans hospitals the actor
 * belongs to. No patient or transaction data is ever touched here.
 */

// ---- Completeness (read + audited recompute) ----

/** Per-hospital completeness for the active hospital (read-only; `config.view`). */
export async function getConfigurationCompleteness(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<CompletenessResult> {
  await requireCapability(actor, ctx, "config.view");
  const summary = await gatherHospitalConfigSummary(ctx.hospitalId);
  return computeCompleteness(summary);
}

/** Recompute + record `config.completeness.recomputed` for the active hospital. */
export async function recomputeConfigurationCompleteness(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<CompletenessResult> {
  await requireCapability(actor, ctx, "config.view");
  const summary = await gatherHospitalConfigSummary(ctx.hospitalId);
  const result = computeCompleteness(summary);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.configCompletenessRecomputed,
    entityType: "Hospital",
    entityId: ctx.hospitalId,
    summary: `Recalcul de complétude de configuration : ${result.configuredCount}/${result.total} (${result.percent}%)`,
  });
  return result;
}

export type HospitalCompleteness = {
  hospitalId: string;
  code: string;
  name: string;
  region: string;
  completeness: CompletenessResult;
};

/**
 * Completeness for EVERY hospital the actor is a member of — the data behind the Bertoua/Ebolowa
 * comparison. Scoping is intrinsic: only the actor's own hospitals are gathered, never others.
 */
export async function listAccessibleHospitalCompleteness(
  actor: AuthenticatedActor,
): Promise<HospitalCompleteness[]> {
  const hospitals = await getAccessibleHospitals(actor);
  const out: HospitalCompleteness[] = [];
  for (const h of hospitals) {
    const ctx: HospitalContext = { hospitalId: h.id, code: h.code, name: h.name, region: h.region };
    await requireCapability(actor, ctx, "config.view");
    const summary = await gatherHospitalConfigSummary(h.id);
    out.push({
      hospitalId: h.id,
      code: h.code,
      name: h.name,
      region: h.region,
      completeness: computeCompleteness(summary),
    });
  }
  return out;
}

/** Category-by-category comparison of two accessible hospitals (reference vs candidate). */
export async function compareTwoHospitals(
  actor: AuthenticatedActor,
  referenceHospitalId: string,
  candidateHospitalId: string,
) {
  const all = await listAccessibleHospitalCompleteness(actor);
  const reference = all.find((h) => h.hospitalId === referenceHospitalId);
  const candidate = all.find((h) => h.hospitalId === candidateHospitalId);
  if (!reference || !candidate) {
    throw new Error("Comparaison impossible : hôpital hors de votre périmètre.");
  }
  return {
    reference,
    candidate,
    rows: compareCompleteness(reference.completeness, candidate.completeness),
  };
}

// ---- Templates (shared blueprints; `config.template.manage`) ----

/** List active templates available to apply (`config.view`). */
export async function listTemplates(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.view");
  return listConfigurationTemplates();
}

export type CreateTemplateInput = {
  code: string;
  name: string;
  description?: string | null;
  sourceHospitalId?: string | null;
  content: unknown;
};

/** Create a shared configuration template from a validated content payload. */
export async function createTemplate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: CreateTemplateInput,
) {
  await requireCapability(actor, ctx, "config.template.manage", { type: "ConfigurationTemplate" });
  const check = validateTemplateContent(input.content);
  if (!check.ok) throw new Error(check.errors[0]);
  const template = await createConfigurationTemplate({
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description ?? null,
    sourceHospitalId: input.sourceHospitalId ?? null,
    content: check.content,
  });
  const counts = summarizeTemplateContent(check.content);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.configTemplateCreated,
    entityType: "ConfigurationTemplate",
    entityId: template.id,
    summary: `Création du modèle de configuration ${template.code} (${counts.departments} dép., ${counts.services} services, ${counts.settings} paramètres)`,
  });
  return template;
}

export type UpdateTemplateInput = {
  name?: string;
  description?: string | null;
  content?: unknown;
  bumpVersion?: boolean;
};

/** Update a template's metadata and/or content (re-validated); optionally bump the version. */
export async function updateTemplate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: UpdateTemplateInput,
) {
  await requireCapability(actor, ctx, "config.template.manage", { type: "ConfigurationTemplate", id });
  const existing = await findConfigurationTemplateById(id);
  if (!existing) throw new Error("Modèle de configuration introuvable.");
  let content: ConfigurationTemplateContent | undefined;
  if (input.content !== undefined) {
    const check = validateTemplateContent(input.content);
    if (!check.ok) throw new Error(check.errors[0]);
    content = check.content;
  }
  const template = await updateConfigurationTemplate(id, {
    name: input.name?.trim(),
    description: input.description,
    content,
    version: input.bumpVersion ? existing.version + 1 : undefined,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.configTemplateUpdated,
    entityType: "ConfigurationTemplate",
    entityId: template.id,
    summary: `Mise à jour du modèle de configuration ${template.code} (v${template.version})`,
  });
  return template;
}

/**
 * Apply a template to the ACTIVE hospital instance — a guarded, scoped write (config only).
 * Requires `config.instance.manage`; records `config.template.applied` with the row counts.
 */
export async function applyTemplate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  templateId: string,
) {
  await requireCapability(actor, ctx, "config.instance.manage", { type: "ConfigurationTemplate", id: templateId });
  const template = await findConfigurationTemplateById(templateId);
  if (!template) throw new Error("Modèle de configuration introuvable.");
  if (!template.isActive) throw new Error("Ce modèle de configuration est désactivé.");
  const result = await applyTemplateToHospital({
    hospitalId: ctx.hospitalId,
    template: {
      id: template.id,
      code: template.code,
      version: template.version,
      content: template.content,
    },
    appliedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.configTemplateApplied,
    entityType: "ConfigurationTemplateApplication",
    entityId: result.applicationId,
    summary: `Application du modèle ${template.code} v${template.version} à ${ctx.code} : ${result.createdCount} créés, ${result.updatedCount} mis à jour`,
  });
  return result;
}

/** Apply history for the active hospital (`config.view`). */
export async function listTemplateApplications(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.view");
  return listConfigurationTemplateApplications(ctx.hospitalId);
}

// ---- Instance overrides (`config.instance.manage`) ----

/**
 * Override a single configuration Setting for the ACTIVE hospital instance (e.g. a different
 * language or document footer than the template provided) — the per-instance divergence path.
 * Scoped via a composite-unique upsert; records `config.instance.updated`.
 */
export async function overrideInstanceSetting(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  key: string,
  value: string,
) {
  await requireCapability(actor, ctx, "config.instance.manage", { type: "Setting" });
  const trimmedKey = key.trim();
  if (!trimmedKey) throw new Error("La clé du paramètre est requise.");
  const setting = await upsertSetting(ctx.hospitalId, trimmedKey, value);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.configInstanceUpdated,
    entityType: "Setting",
    entityId: setting.id,
    summary: `Paramètre d'instance mis à jour pour ${ctx.code} : ${trimmedKey}`,
  });
  return setting;
}

export type { HospitalConfigSummary };
