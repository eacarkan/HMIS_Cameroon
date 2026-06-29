import {
  normalizeMedicationDisplayOrder,
  validateMedicationInput,
  type MedicationInput,
} from "@/lib/medication";
import {
  createMedication as dbCreate,
  findMedicationByCode,
  findMedicationById,
  listActiveMedications as dbListActive,
  listMedications as dbList,
  updateMedication as dbUpdate,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Medication catalogue service (Phase 2D-1). The Hospital Administrator manages the catalogue
 * (`medication.manage`); clinicians + pharmacy + oversight read it (`medication.view`). Hospital
 * scoped; audited. No quantities/prices here (stock = 2D-3, prescriptions = 2D-2).
 */

export async function listMedicationCatalogue(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "medication.view");
  return dbList(ctx.hospitalId);
}

export async function listActiveMedications(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "medication.view");
  return dbListActive(ctx.hospitalId);
}

export async function createMedication(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: MedicationInput & { displayOrder?: number },
) {
  await requireCapability(actor, ctx, "medication.manage", { type: "Medication" });
  const check = validateMedicationInput(input);
  if (!check.ok) throw new Error(check.error);
  const existing = await findMedicationByCode(ctx.hospitalId, input.code.trim());
  if (existing) throw new Error("Un médicament avec ce code existe déjà dans cet hôpital.");

  const med = await dbCreate({
    hospitalId: ctx.hospitalId,
    code: input.code.trim(),
    nameFr: input.nameFr.trim(),
    nameEn: input.nameEn.trim(),
    form: input.form.trim(),
    unit: input.unit.trim(),
    strength: input.strength?.trim() || null,
    displayOrder: normalizeMedicationDisplayOrder(input.displayOrder),
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.medicationCreated,
    entityType: "Medication",
    entityId: med.id,
    summary: `Création du médicament ${med.nameFr} (${med.code})`,
  });
  return med;
}

export async function updateMedication(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: Partial<{
    nameFr: string;
    nameEn: string;
    form: string;
    unit: string;
    strength: string | null;
    displayOrder: number;
  }>,
) {
  await requireCapability(actor, ctx, "medication.manage", { type: "Medication", id });
  const existing = await findMedicationById(ctx.hospitalId, id);
  if (!existing) throw new Error("Médicament introuvable dans cet hôpital.");
  for (const key of ["nameFr", "nameEn", "form", "unit"] as const) {
    if (input[key] !== undefined && !input[key]!.trim()) {
      throw new Error("Les champs nom, forme et unité ne peuvent pas être vides.");
    }
  }
  await dbUpdate(ctx.hospitalId, id, {
    nameFr: input.nameFr?.trim(),
    nameEn: input.nameEn?.trim(),
    form: input.form?.trim(),
    unit: input.unit?.trim(),
    strength: input.strength === undefined ? undefined : input.strength?.trim() || null,
    displayOrder:
      input.displayOrder === undefined ? undefined : normalizeMedicationDisplayOrder(input.displayOrder),
    updatedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.medicationUpdated,
    entityType: "Medication",
    entityId: id,
    summary: `Mise à jour du médicament ${existing.code}`,
  });
  return findMedicationById(ctx.hospitalId, id);
}

export async function deactivateMedication(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "medication.manage", { type: "Medication", id });
  const existing = await findMedicationById(ctx.hospitalId, id);
  if (!existing) throw new Error("Médicament introuvable dans cet hôpital.");
  await dbUpdate(ctx.hospitalId, id, { isActive: false, updatedById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.medicationDeactivated,
    entityType: "Medication",
    entityId: id,
    summary: `Désactivation du médicament ${existing.code}`,
  });
  return findMedicationById(ctx.hospitalId, id);
}

export async function reactivateMedication(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "medication.manage", { type: "Medication", id });
  const existing = await findMedicationById(ctx.hospitalId, id);
  if (!existing) throw new Error("Médicament introuvable dans cet hôpital.");
  await dbUpdate(ctx.hospitalId, id, { isActive: true, updatedById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.medicationReactivated,
    entityType: "Medication",
    entityId: id,
    summary: `Réactivation du médicament ${existing.code}`,
  });
  return findMedicationById(ctx.hospitalId, id);
}
