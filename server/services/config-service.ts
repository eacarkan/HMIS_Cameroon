import {
  type HospitalContext,
  listDepartments as dbListDepartments,
  createDepartment as dbCreateDepartment,
  findDepartmentById,
  updateDepartment as dbUpdateDepartment,
  listServiceUnits as dbListServiceUnits,
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

// ---- ServiceUnit ----
export async function listServiceUnits(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "config.read");
  return dbListServiceUnits(ctx.hospitalId);
}

export async function createServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; kind?: string | null; departmentId?: string | null },
) {
  await requireCapability(actor, ctx, "config.manage", { type: "ServiceUnit" });
  // A service unit's department must belong to the SAME hospital.
  if (input.departmentId) {
    const dept = await findDepartmentById(ctx.hospitalId, input.departmentId);
    if (!dept) throw new Error("Département invalide pour cet hôpital.");
  }
  const unit = await dbCreateServiceUnit({
    hospitalId: ctx.hospitalId,
    code: input.code,
    name: input.name,
    kind: input.kind ?? null,
    departmentId: input.departmentId ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceUnitCreate,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Création de l'unité de service ${unit.name} (${unit.code})`,
  });
  return unit;
}

export async function deactivateServiceUnit(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "config.manage", { type: "ServiceUnit", id });
  const existing = await findServiceUnitById(ctx.hospitalId, id);
  if (!existing) throw new Error("Unité de service introuvable dans cet hôpital.");
  const unit = await dbUpdateServiceUnit(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.serviceUnitDeactivate,
    entityType: "ServiceUnit",
    entityId: unit.id,
    summary: `Désactivation de l'unité de service ${unit.code}`,
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
