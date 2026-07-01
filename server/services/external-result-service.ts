import {
  createExternalResultImport,
  decideExternalResultImport,
  enterDiagnosticResultTx,
  findDiagnosticOrderById,
  findDiagnosticOrderByNumberForImport,
  findExternalResultImportById,
  findExternalResultImportByRef,
  findPatientByNumberForImport,
  listExternalResultImports,
  type HospitalContext,
} from "@/server/db";
import { canReviewImport, parseImportCsv } from "@/lib/external-result";
import { AuthorizationError, canAtHospital } from "@/server/authz";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * External lab/radiology result import service (Phase 4C). Imported results are STAGING records — they
 * are matched (WARNINGS ONLY) and routed to a review queue. Only an authorized REVIEWER (≠ the importer)
 * may promote a staged result into the clinical record, and promotion goes through the EXISTING Phase 2I
 * `enterDiagnosticResultTx` — so the result is entered (by the reviewer) but STILL hidden from the doctor
 * until a SEPARATE validator validates it (Phase 3 validator separation preserved). NOTHING here writes
 * a validated clinical result; no analyzer/PACS/DICOM; no live connection. Hospital-scoped; audited.
 */

export async function importExternalResults(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { source: string; csv: string },
) {
  await requireCapability(actor, ctx, "external_result.import", { type: "ExternalResultImport" });
  const source = (input.source || "CSV").trim().toUpperCase();
  const { rows, errors } = parseImportCsv(input.csv);

  let imported = 0;
  let duplicates = 0;
  let warnings = 0;

  for (const row of rows) {
    // Dedupe — the (hospitalId, source, externalRef) unique key is the authoritative guard.
    if (await findExternalResultImportByRef(ctx.hospitalId, source, row.externalRef)) {
      duplicates += 1;
      continue;
    }
    // Matching — WARNINGS ONLY (never an automatic clinical link).
    const patient = await findPatientByNumberForImport(ctx.hospitalId, row.patientRef);
    let matchedOrderId: string | null = null;
    const warningParts: string[] = [];
    if (!patient) warningParts.push(`patient « ${row.patientRef} » introuvable`);
    if (row.orderRef) {
      const order = await findDiagnosticOrderByNumberForImport(ctx.hospitalId, row.orderRef);
      if (!order) warningParts.push(`commande « ${row.orderRef} » introuvable`);
      else if (!patient) warningParts.push("commande trouvée mais patient non rapproché");
      else if (order.patientId !== patient.id) warningParts.push("patient/commande incohérents");
      // Only a CONSISTENT (patient, order) pair becomes a promotion candidate — a mismatched or
      // unverified order is NEVER stored as matchedOrderId, so it can never be a promotion target
      // (a reviewer cannot promote patient A's result onto patient B's order).
      else matchedOrderId = order.id;
    } else {
      warningParts.push("aucune référence de commande");
    }
    const matchWarning = warningParts.length > 0 ? warningParts.join(" ; ") : null;

    const staged = await createExternalResultImport({
      hospitalId: ctx.hospitalId,
      source,
      externalRef: row.externalRef,
      patientRef: row.patientRef,
      orderRef: row.orderRef,
      modality: row.modality,
      testCode: row.testCode,
      resultText: row.resultText,
      matchedPatientId: patient?.id ?? null,
      matchedOrderId,
      matchWarning,
      status: "NEEDS_REVIEW",
      importedById: actor.id,
    });
    imported += 1;
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.externalResultImported,
      entityType: "ExternalResultImport",
      entityId: staged.id,
      summary: `Résultat externe importé (${source}, ${row.testCode}) — STAGING, non clinique`,
    });
    if (matchWarning) {
      warnings += 1;
      await recordAudit({
        hospitalId: ctx.hospitalId,
        actorId: actor.id,
        action: AUDIT_ACTIONS.externalResultMatchWarning,
        entityType: "ExternalResultImport",
        entityId: staged.id,
        summary: `Avertissement de rapprochement : ${matchWarning}`,
      });
    }
  }
  return { imported, duplicates, warnings, errors };
}

/** The review queue — visible to the importer OR an authorized reviewer (both need to see staging). */
export async function getExternalResultQueue(actor: AuthenticatedActor, ctx: HospitalContext) {
  const roles = actor.rolesByHospital[ctx.hospitalId] ?? [];
  if (!canAtHospital(actor.rolesByHospital, ctx.hospitalId, "external_result.review") &&
      !canAtHospital(actor.rolesByHospital, ctx.hospitalId, "external_result.import")) {
    throw new AuthorizationError("external_result.review");
  }
  void roles;
  return {
    items: await listExternalResultImports(ctx.hospitalId),
    canReview: canAtHospital(actor.rolesByHospital, ctx.hospitalId, "external_result.review"),
  };
}

/**
 * Review a staged import: PROMOTE (into the clinical record via the existing Phase 2I enter path) or
 * REJECT. The reviewer MUST be different from the importer (clinical separation), and a promote enters
 * the result — which is STILL hidden from the doctor until a separate validator validates it.
 */
export async function reviewExternalResult(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { decision: "promote" | "reject"; reason?: string | null },
) {
  await requireCapability(actor, ctx, "external_result.review", { type: "ExternalResultImport", id });
  const staged = await findExternalResultImportById(ctx.hospitalId, id);
  if (!staged) throw new Error("Importation introuvable dans cet hôpital.");
  if (!canReviewImport(staged.status)) throw new Error("Cette importation a déjà été traitée.");
  // SEPARATION: the importer cannot review their own import.
  if (staged.importedById && staged.importedById === actor.id) {
    throw new Error("L'importateur ne peut pas réviser sa propre importation (séparation des rôles).");
  }

  if (input.decision === "reject") {
    const count = await decideExternalResultImport(ctx.hospitalId, id, {
      status: "REJECTED",
      reviewedById: actor.id,
      reviewReason: input.reason?.trim() || null,
    });
    if (count === 0) throw new Error("Cette importation a déjà été traitée.");
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.externalResultRejected,
      entityType: "ExternalResultImport",
      entityId: id,
      summary: `Résultat externe REJETÉ — ${input.reason?.trim() || "sans motif"}`,
    });
    return findExternalResultImportById(ctx.hospitalId, id);
  }

  // PROMOTE — requires a matched order that is IN PROGRESS (accepts a result entry).
  if (!staged.matchedOrderId) {
    throw new Error("Aucune commande diagnostique correspondante — impossible de promouvoir.");
  }
  const order = await findDiagnosticOrderById(ctx.hospitalId, staged.matchedOrderId);
  if (!order) throw new Error("Commande diagnostique introuvable dans cet hôpital.");
  // Defense-in-depth against a wrong-patient write: the matched order must still belong to the matched
  // patient (a mismatch is never stored as matchedOrderId at import, but re-verify at promote time).
  if (staged.matchedPatientId && order.patientId !== staged.matchedPatientId) {
    throw new Error("Incohérence patient/commande — promotion refusée (sécurité patient).");
  }
  if (order.status !== "in_progress") {
    throw new Error("La commande doit être « en cours » pour recevoir un résultat importé.");
  }
  // Enter the result via the EXISTING Phase 2I path (reviewer = enterer; a separate validator validates).
  await enterDiagnosticResultTx({
    hospitalId: ctx.hospitalId,
    id: order.id,
    resultText: staged.resultText,
    resultEnteredById: actor.id,
  });
  const count = await decideExternalResultImport(ctx.hospitalId, id, {
    status: "PROMOTED",
    reviewedById: actor.id,
    promotedOrderId: order.id,
  });
  if (count === 0) throw new Error("Cette importation a déjà été traitée.");
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.externalResultPromoted,
    entityType: "ExternalResultImport",
    entityId: id,
    summary: `Résultat externe PROMU — saisi sur la commande ${order.orderNumber} (validation séparée requise avant visibilité médecin)`,
  });
  return findExternalResultImportById(ctx.hospitalId, id);
}
