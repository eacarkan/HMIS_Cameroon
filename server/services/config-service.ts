import type { ServiceType } from "@prisma/client";

import {
  type ServiceEligibility,
  ELIGIBILITY_FLAGS,
  normalizeDisplayOrder,
  validateServiceCatalogueInput,
} from "@/lib/service-catalogue";
import {
  type HospitalContext,
  listDepartments as dbListDepartments,
  createDepartment as dbCreateDepartment,
  findDepartmentById,
  updateDepartment as dbUpdateDepartment,
  listServiceUnits as dbListServiceUnits,
  listServiceUnitsOrdered as dbListServiceUnitsOrdered,
  listActiveServiceUnits as dbListActiveServiceUnits,
  reorderServiceUnits as dbReorderServiceUnits,
  createServiceUnit as dbCreateServiceUnit,
  findServiceUnitById,
  updateServiceUnit as dbUpdateServiceUnit,
  listSettings as dbListSettings,
  upsertSetting,
  listDocumentTemplates as dbListDocumentTemplates,
  createDocumentTemplate as dbCreateDocumentTemplate,
  findDocumentTemplateById,
  updateDocumentTemplate as dbUpdateDocumentTemplate,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Configuration service (Gate 3, 23 §5) — Department / ServiceUnit / Setting /
 * DocumentTemplate. Server-side RBAC (SYS/ADM manage, DIR may read), hospital scoping
 * on every action, and an audit event per mutation. No UI. Soft-deactivate via
 * `isActive`. Reads require `config.read`; mutations require `config.manage`.
 */

// ---- Department ----
export async function listDepartments(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.read");
  return dbListDepartments(ctx.hospitalId);
}

export async function createDepartment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string },
) {
  await requireCapability(actor, ctx, "config.manage", { type: "Department" });
  const dept = await dbCreateDepartment({
    hospitalId: ctx.hospitalId,
    code: input.code,
    name: input.name,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.departmentCreate,
    entityType: "Department",
    entityId: dept.id,
    summary: `Création du département ${dept.name} (${dept.code})`,
  });
  return dept;
}

export async function updateDepartment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { name?: string },
) {
  await requireCapability(actor, ctx, "config.manage", { type: "Department", id });
  const existing = await findDepartmentById(ctx.hospitalId, id);
  if (!existing) throw new Error("Département introuvable dans cet hôpital.");
  const dept = await dbUpdateDepartment(id, { name: input.name });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.departmentUpdate,
    entityType: "Department",
    entityId: dept.id,
    summary: `Mise à jour du département ${dept.code}`,
  });
  return dept;
}

export async function deactivateDepartment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "config.manage", { type: "Department", id });
  const existing = await findDepartmentById(ctx.hospitalId, id);
  if (!existing) throw new Error("Département introuvable dans cet hôpital.");
  const dept = await dbUpdateDepartment(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.departmentDeactivate,
    entityType: "Department",
    entityId: dept.id,
    summary: `Désactivation du département ${dept.code}`,
  });
  return dept;
}

// ---- ServiceUnit = the Phase 2A service/department catalogue ----
// Capability-based RBAC: `service.config.manage` (Hospital Admin) for mutations + full
// catalogue reads; `service.config.view` for downstream ACTIVE-service pickers. Hospital
// scoped on every path; an audit event per mutation; validation via the pure lib.

/** Full catalogue input (create/update). `name` (legacy) mirrors `nameFr` for back-compat. */
export type ServiceConfigInput = {
  code: string;
  nameFr: string;
  nameEn?: string | null;
  type: string;
  displayOrder?: number;
  departmentId?: string | null;
  kind?: string | null;
} & Partial<ServiceEligibility>;

/** Resolve all eight eligibility flags, defaulting unspecified ones to false. */
function eligibilityFrom(input: Partial<ServiceEligibility>): ServiceEligibility {
  return {
    acceptsQueue: input.acceptsQueue ?? false,
    acceptsConsultation: input.acceptsConsultation ?? false,
    supportsBilling: input.supportsBilling ?? false,
    supportsPharmacy: input.supportsPharmacy ?? false,
    supportsLab: input.supportsLab ?? false,
    supportsImaging: input.supportsImaging ?? false,
    isInpatientWard: input.isInpatientWard ?? false,
    isEmergency: input.isEmergency ?? false,
  };
}

/** Back-compat minimal list (config.read). Kept for the existing administration view. */
export async function listServiceUnits(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.read");
  return dbListServiceUnits(ctx.hospitalId);
}

/** Full ordered catalogue incl. inactive — management screen (service.config.manage). */
export async function listServiceCatalogue(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "service.config.manage");
  return dbListServiceUnitsOrdered(ctx.hospitalId);
}

/** Active services only — downstream read-only pickers (service.config.view). */
export async function listActiveServices(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "service.config.view");
  return dbListActiveServiceUnits(ctx.hospitalId);
}

export async function createServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: ServiceConfigInput,
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit" });
  const flags = eligibilityFrom(input);
  const check = validateServiceCatalogueInput({
    code: input.code,
    nameFr: input.nameFr,
    nameEn: input.nameEn,
    type: input.type,
    displayOrder: input.displayOrder,
    ...flags,
  });
  if (!check.ok) throw new Error(check.errors[0]);
  // A service's department must belong to the SAME hospital.
  if (input.departmentId) {
    const dept = await findDepartmentById(ctx.hospitalId, input.departmentId);
    if (!dept) throw new Error("Département invalide pour cet hôpital.");
  }
  const nameFr = input.nameFr.trim();
  const unit = await dbCreateServiceUnit({
    hospitalId: ctx.hospitalId,
    code: input.code.trim(),
    name: nameFr,
    nameFr,
    nameEn: input.nameEn?.trim() || null,
    type: input.type as ServiceType,
    displayOrder: input.displayOrder ?? 0,
    kind: input.kind?.trim() || null,
    departmentId: input.departmentId ?? null,
    ...flags,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceCreated,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Création du service ${nameFr} (${unit.code})`,
  });
  return unit;
}

export async function updateServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: ServiceConfigInput,
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit", id });
  const existing = await findServiceUnitById(ctx.hospitalId, id);
  if (!existing) throw new Error("Service introuvable dans cet hôpital.");
  // Preserve existing eligibility flags unless explicitly provided — flags are managed by the
  // dedicated setServiceEligibility path (→ `service.eligibility_changed`), so an identity
  // edit (name/type/order/department) never silently clears them.
  const flags: ServiceEligibility = { ...eligibilityFrom(existing) };
  for (const key of ELIGIBILITY_FLAGS) {
    if (input[key] !== undefined) flags[key] = input[key] as boolean;
  }
  const check = validateServiceCatalogueInput({
    code: existing.code, // code is immutable on update
    nameFr: input.nameFr,
    nameEn: input.nameEn,
    type: input.type,
    displayOrder: input.displayOrder,
    ...flags,
  });
  if (!check.ok) throw new Error(check.errors[0]);
  if (input.departmentId) {
    const dept = await findDepartmentById(ctx.hospitalId, input.departmentId);
    if (!dept) throw new Error("Département invalide pour cet hôpital.");
  }
  const nameFr = input.nameFr.trim();
  const unit = await dbUpdateServiceUnit(id, {
    name: nameFr,
    nameFr,
    nameEn: input.nameEn?.trim() || null,
    type: input.type as ServiceType,
    displayOrder: input.displayOrder,
    kind: input.kind?.trim() || null,
    departmentId: input.departmentId ?? null,
    ...flags,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceUpdated,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Mise à jour du service ${nameFr} (${unit.code})`,
  });
  return unit;
}

export async function deactivateServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit", id });
  const existing = await findServiceUnitById(ctx.hospitalId, id);
  if (!existing) throw new Error("Service introuvable dans cet hôpital.");
  const unit = await dbUpdateServiceUnit(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceDeactivated,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Désactivation du service ${unit.code}`,
  });
  return unit;
}

export async function reactivateServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit", id });
  const existing = await findServiceUnitById(ctx.hospitalId, id);
  if (!existing) throw new Error("Service introuvable dans cet hôpital.");
  const unit = await dbUpdateServiceUnit(id, { isActive: true });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceReactivated,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Réactivation du service ${unit.code}`,
  });
  return unit;
}

/** Reorder the catalogue: every id must belong to this hospital; order applied atomically. */
export async function reorderServices(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  orderedIds: string[],
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit" });
  for (const id of orderedIds) {
    const exists = await findServiceUnitById(ctx.hospitalId, id);
    if (!exists) throw new Error("Service introuvable dans cet hôpital.");
  }
  await dbReorderServiceUnits(ctx.hospitalId, normalizeDisplayOrder(orderedIds));
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceReordered,
    entityType: "ServiceUnit",
    entityId: null,
    summary: `Réordonnancement de ${orderedIds.length} service(s)`,
  });
}

/** Toggle eligibility flags; validated against the service's existing type (spec §6/§9). */
export async function setServiceEligibility(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  flags: Partial<ServiceEligibility>,
) {
  await requireCapability(actor, ctx, "service.config.manage", { type: "ServiceUnit", id });
  const existing = await findServiceUnitById(ctx.hospitalId, id);
  if (!existing) throw new Error("Service introuvable dans cet hôpital.");
  const merged = { ...eligibilityFrom(existing), ...flags };
  const check = validateServiceCatalogueInput({
    code: existing.code,
    nameFr: existing.nameFr ?? existing.name,
    type: existing.type,
    ...merged,
  });
  if (!check.ok) throw new Error(check.errors[0]);
  const unit = await dbUpdateServiceUnit(id, merged);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceEligibilityChanged,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Mise à jour des éligibilités du service ${unit.code}`,
  });
  return unit;
}

// ---- Setting ----
export async function listSettings(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.read");
  return dbListSettings(ctx.hospitalId);
}

export async function updateSetting(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  key: string,
  value: string,
) {
  await requireCapability(actor, ctx, "config.manage", { type: "Setting" });
  const setting = await upsertSetting(ctx.hospitalId, key, value);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.settingUpdate,
    entityType: "Setting",
    entityId: setting.id,
    summary: `Paramètre mis à jour : ${key}`,
  });
  return setting;
}

// ---- DocumentTemplate ----
export async function listDocumentTemplates(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "config.read");
  return dbListDocumentTemplates(ctx.hospitalId);
}

export async function createDocumentTemplate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { type: string; name: string; header?: string | null; body?: string | null },
) {
  await requireCapability(actor, ctx, "config.manage", { type: "DocumentTemplate" });
  const tpl = await dbCreateDocumentTemplate({
    hospitalId: ctx.hospitalId,
    type: input.type,
    name: input.name,
    header: input.header ?? null,
    body: input.body ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.documentTemplateCreate,
    entityType: "DocumentTemplate",
    entityId: tpl.id,
    summary: `Création du modèle de document ${tpl.name} (${tpl.type})`,
  });
  return tpl;
}

export async function deactivateDocumentTemplate(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "config.manage", { type: "DocumentTemplate", id });
  const existing = await findDocumentTemplateById(ctx.hospitalId, id);
  if (!existing) throw new Error("Modèle de document introuvable dans cet hôpital.");
  const tpl = await dbUpdateDocumentTemplate(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.documentTemplateDeactivate,
    entityType: "DocumentTemplate",
    entityId: tpl.id,
    summary: `Désactivation du modèle de document ${tpl.name}`,
  });
  return tpl;
}
