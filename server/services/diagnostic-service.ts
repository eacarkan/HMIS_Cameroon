import type { DiagnosticModality } from "@prisma/client";

import {
  cancelDiagnosticTx,
  confirmDiagnosticPaymentTx,
  createDiagnosticCatalogueItem as dbCreateCatalogueItem,
  createDiagnosticOrder,
  enterDiagnosticResultTx,
  findDiagnosticCatalogueItemById,
  findDiagnosticOrderById,
  findEncounterById,
  findUserByIdWithRoles,
  listActiveDiagnosticCatalogue,
  listDiagnosticCatalogue,
  listDiagnosticOrdersForEncounter,
  listDiagnosticWorklist,
  startDiagnosticTx,
  updateDiagnosticCatalogueItem,
  validateDiagnosticResultTx,
  type HospitalContext,
} from "@/server/db";
import {
  canStartDiagnostic,
  isDiagnosticModality,
  isResultVisible,
  type DiagnosticStatusCode,
  validateDiagnosticCatalogueInput,
  validateResultText,
} from "@/lib/diagnostics";
import { canAtHospital } from "@/lib/rbac";
import { formatFcfa } from "@/lib/money";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Manual lab/radiology service (Phase 2I). A doctor requests a catalogued test/exam; the cashier
 * confirms payment (bypassed for emergency encounters, 2H); a technician enters a manual text result;
 * a validator validates it; a PDF is produced. THE RESULT IS HIDDEN FROM THE DOCTOR UNTIL VALIDATED —
 * enforced here, at the service boundary, by stripping `resultText` for non-staff viewers. Hospital-
 * scoped; every action audited. No analyzer/PACS/DICOM; radiology is text-only.
 */

type OrderRow = NonNullable<Awaited<ReturnType<typeof findDiagnosticOrderById>>>;

/** A viewer is "staff" (may see a result before it is validated) iff they enter or validate results
 *  AT the active hospital — per-hospital roles, never the cross-hospital union (Phase 3B). */
function isDiagnosticStaff(actor: AuthenticatedActor, hospitalId: string): boolean {
  return (
    canAtHospital(actor.rolesByHospital, hospitalId, "diagnostic.result.enter") ||
    canAtHospital(actor.rolesByHospital, hospitalId, "diagnostic.validate")
  );
}

/** Strip the result text unless the viewer is allowed to see it for this status (the visibility gate). */
function applyVisibility<T extends { status: string; resultText: string | null }>(
  order: T,
  isStaff: boolean,
): T {
  const visible = isResultVisible(order.status as DiagnosticStatusCode, isStaff);
  return visible ? order : { ...order, resultText: null };
}

// --- Catalogue (admin / lead-tech) ---

export async function listDiagnosticCatalogueAll(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "diagnostic.catalogue.manage");
  return listDiagnosticCatalogue(ctx.hospitalId);
}

export async function listOrderableDiagnostics(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  modality?: DiagnosticModality,
) {
  await requireCapability(actor, ctx, "diagnostic.read");
  return listActiveDiagnosticCatalogue(ctx.hospitalId, modality);
}

export async function createDiagnosticCatalogueItem(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; nameFr: string; nameEn?: string | null; modality: string; price: number; displayOrder?: number },
) {
  await requireCapability(actor, ctx, "diagnostic.catalogue.manage", { type: "DiagnosticCatalogueItem" });
  const check = validateDiagnosticCatalogueInput(input);
  if (!check.ok) throw new Error(check.errors.join(" "));
  if (!isDiagnosticModality(input.modality)) throw new Error("Modalité invalide.");
  const item = await dbCreateCatalogueItem({
    hospitalId: ctx.hospitalId,
    code: input.code.trim(),
    nameFr: input.nameFr.trim(),
    nameEn: input.nameEn?.trim() || null,
    modality: input.modality,
    price: input.price,
    displayOrder: input.displayOrder,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticCatalogueChanged,
    entityType: "DiagnosticCatalogueItem",
    entityId: item.id,
    summary: `Examen ajouté : ${item.code} — ${item.nameFr} (${formatFcfa(item.price)})`,
  });
  return item;
}

export async function setDiagnosticCatalogueItemActive(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  isActive: boolean,
) {
  await requireCapability(actor, ctx, "diagnostic.catalogue.manage", { type: "DiagnosticCatalogueItem", id });
  const item = await findDiagnosticCatalogueItemById(ctx.hospitalId, id);
  if (!item) throw new Error("Examen introuvable dans cet hôpital.");
  await updateDiagnosticCatalogueItem(ctx.hospitalId, id, { isActive });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticCatalogueChanged,
    entityType: "DiagnosticCatalogueItem",
    entityId: id,
    summary: `Examen ${item.code} ${isActive ? "réactivé" : "désactivé"}`,
  });
  return findDiagnosticCatalogueItemById(ctx.hospitalId, id);
}

// --- Orders ---

export async function requestDiagnostic(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { encounterId: string; catalogueItemId: string },
) {
  await requireCapability(actor, ctx, "diagnostic.request", { type: "Encounter", id: input.encounterId });
  const encounter = await findEncounterById(ctx.hospitalId, input.encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  if (encounter.status !== "open") throw new Error("La visite doit être ouverte pour demander un examen.");

  // Server-side enforcement: only an active catalogue item in THIS hospital can be ordered.
  const item = await findDiagnosticCatalogueItemById(ctx.hospitalId, input.catalogueItemId);
  if (!item || !item.isActive) throw new Error("Examen indisponible dans cet hôpital.");

  const orderNumber = await generateNumber(ctx, "diagnostic", new Date().getFullYear());
  const order = await createDiagnosticOrder({
    hospitalId: ctx.hospitalId,
    encounterId: input.encounterId,
    patientId: encounter.patientId,
    catalogueItemId: item.id,
    orderNumber,
    modality: item.modality,
    itemLabel: item.nameFr,
    price: item.price,
    requestedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticRequested,
    entityType: "DiagnosticOrder",
    entityId: order.id,
    summary: `Examen ${order.orderNumber} demandé — ${item.nameFr} (${item.modality})`,
  });
  return order;
}

export async function confirmDiagnosticPayment(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "diagnostic.payment.confirm", { type: "DiagnosticOrder", id });
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) throw new Error("Examen introuvable dans cet hôpital.");
  const updated = await confirmDiagnosticPaymentTx({ hospitalId: ctx.hospitalId, id, paidById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticPaymentConfirmed,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Paiement confirmé — examen ${order.orderNumber} (${formatFcfa(order.price)})`,
  });
  return updated;
}

export async function startDiagnostic(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "diagnostic.result.enter", { type: "DiagnosticOrder", id });
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) throw new Error("Examen introuvable dans cet hôpital.");
  // Payment gate: only paid orders start, UNLESS the encounter is an emergency (2H bypass).
  const isEmergency = order.encounter?.isEmergency ?? false;
  if (!canStartDiagnostic({ status: order.status as DiagnosticStatusCode, isPaid: order.isPaid, isEmergency })) {
    throw new Error("L'examen doit être payé à la caisse avant d'être réalisé (sauf urgence).");
  }
  const emergencyBypass = order.status === "requested" && !order.isPaid && isEmergency;
  // Pre-Gate-7 hardening: an emergency-bypassed exam must be TRACKED so the discharge gate (2G) cannot
  // miss it. Phase 3 QA patch — the priced Emergency Debt is now accrued INSIDE the start transaction
  // (commit-or-fail together): the start fails if the debt cannot be created, and the debt is
  // idempotent by source (a concurrent/retried start cannot duplicate it). Settled by the cashier or
  // waived by the Director before discharge.
  const { order: updated, emergencyDeferred, emergencyDebt } = await startDiagnosticTx({
    hospitalId: ctx.hospitalId,
    id,
    emergencyDebt:
      emergencyBypass && order.price > 0
        ? {
            hospitalId: ctx.hospitalId,
            encounterId: order.encounterId,
            patientId: order.patientId,
            amount: order.price,
            source: `Examen d'urgence — ${order.itemLabel} (${order.orderNumber})`,
            createdById: actor.id,
          }
        : null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticStarted,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Examen ${order.orderNumber} démarré${emergencyDeferred ? " (URGENCE — paiement différé)" : ""}`,
  });
  // Audit the accrual only when a debt was newly created (idempotent reuse must not re-audit).
  if (emergencyDebt?.created) {
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.emergencyDebtAccrued,
      entityType: "EmergencyDebt",
      entityId: emergencyDebt.id,
      summary: `Dette d'urgence ${formatFcfa(order.price)} ouverte automatiquement — examen ${order.orderNumber}`,
    });
  }
  return updated;
}

export async function enterDiagnosticResult(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  resultText: string,
) {
  await requireCapability(actor, ctx, "diagnostic.result.enter", { type: "DiagnosticOrder", id });
  const check = validateResultText(resultText);
  if (!check.ok) throw new Error(check.error);
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) throw new Error("Examen introuvable dans cet hôpital.");
  const updated = await enterDiagnosticResultTx({
    hospitalId: ctx.hospitalId,
    id,
    resultText: resultText.trim(),
    resultEnteredById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticResultEntered,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Résultat saisi — examen ${order.orderNumber}`,
  });
  return updated;
}

export async function validateDiagnosticResult(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "diagnostic.validate", { type: "DiagnosticOrder", id });
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) throw new Error("Examen introuvable dans cet hôpital.");
  // Clinical separation of duties (4-eyes): the validator must NOT be the technician who entered the
  // result — even if one person holds both capabilities. The DB guard below is defence-in-depth.
  if (order.resultEnteredById && order.resultEnteredById === actor.id) {
    throw new Error("La validation doit être effectuée par une personne différente de celle qui a saisi le résultat.");
  }
  const updated = await validateDiagnosticResultTx({
    hospitalId: ctx.hospitalId,
    id,
    validatedById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticValidated,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Résultat validé — examen ${order.orderNumber} (le médecin peut désormais le consulter)`,
  });
  return updated;
}

export async function cancelDiagnostic(actor: AuthenticatedActor, ctx: HospitalContext, id: string, reason: string) {
  await requireCapability(actor, ctx, "diagnostic.request", { type: "DiagnosticOrder", id });
  if (!reason?.trim()) throw new Error("Le motif d'annulation est obligatoire.");
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) throw new Error("Examen introuvable dans cet hôpital.");
  const updated = await cancelDiagnosticTx({ hospitalId: ctx.hospitalId, id, cancelReason: reason.trim() });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticCancelled,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Examen ${order.orderNumber} annulé — motif : ${reason.trim()}`,
  });
  return updated;
}

// --- Reads (visibility-enforced) ---

export async function getDiagnosticOrder(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "diagnostic.read");
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) return null;
  return applyVisibility(order, isDiagnosticStaff(actor, ctx.hospitalId));
}

export async function listDiagnosticsForEncounter(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
) {
  await requireCapability(actor, ctx, "diagnostic.read");
  const orders = await listDiagnosticOrdersForEncounter(ctx.hospitalId, encounterId);
  const isStaff = isDiagnosticStaff(actor, ctx.hospitalId);
  return orders.map((o) => applyVisibility(o, isStaff));
}

export async function getDiagnosticWorklist(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  modality?: DiagnosticModality,
) {
  await requireCapability(actor, ctx, "diagnostic.read");
  const orders = await listDiagnosticWorklist(ctx.hospitalId, modality);
  const isStaff = isDiagnosticStaff(actor, ctx.hospitalId);
  return orders.map((o) => applyVisibility(o, isStaff));
}

/**
 * Data for the printable report — ONLY for a validated order (the PDF is produced after validation).
 * Includes the validator's name. Records a `diagnostic.pdf_generated` audit entry.
 */
export async function getDiagnosticReport(actor: AuthenticatedActor, ctx: HospitalContext, id: string): Promise<{
  order: OrderRow;
  validatorName: string | null;
} | null> {
  await requireCapability(actor, ctx, "diagnostic.read");
  const order = await findDiagnosticOrderById(ctx.hospitalId, id);
  if (!order) return null;
  if (order.status !== "validated") {
    throw new Error("Le compte rendu n'est disponible qu'après validation.");
  }
  const validator = order.validatedById ? await findUserByIdWithRoles(order.validatedById) : null;
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.diagnosticPdfGenerated,
    entityType: "DiagnosticOrder",
    entityId: id,
    summary: `Compte rendu imprimé — examen ${order.orderNumber}`,
  });
  return { order, validatorName: validator?.displayName ?? null };
}
