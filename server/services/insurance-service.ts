import {
  countClaimsForHospital,
  createClaimDraft,
  createCoverageProfile,
  createPatientCoverage,
  createPayer,
  createPreAuth,
  decidePreAuthTx,
  findPreAuthById,
  findClaimById,
  findCoverageProfileByCode,
  findInvoiceById,
  findPatientCoverageById,
  findPatientForCoverage,
  findPayerByCode,
  findPayerById,
  listClaims,
  listPatientCoverages,
  listPayers,
  listPreAuths,
  setPatientCoverageEligibility,
  transitionClaimStatus,
  type HospitalContext,
} from "@/server/db";
import {
  type ClaimStatusCode,
  type EligibilityStatusCode,
  canTransitionClaim,
  validateCoverageLinkInput,
  validateCoverageProfileInput,
  validatePayerInput,
} from "@/lib/insurance";
import { AuthorizationError, canAtHospital } from "@/server/authz";
import { formatFcfa } from "@/lib/money";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Insurance / mutuelle service (Phase 4E). Payer registry + coverage profiles (payer.manage), patient
 * coverage links + eligibility PLACEHOLDER + pre-authorization + claim drafts (claim.manage). ALL manual
 * — no insurer API, no auto-adjudication, no automatic claim submission ("SUBMITTED_PLACEHOLDER" is a
 * manual status). Billing-linked (a claim may reference an invoice). Hospital-scoped; audited.
 */

export async function getInsuranceAdmin(actor: AuthenticatedActor, ctx: HospitalContext) {
  const canManagePayers = canAtHospital(actor.rolesByHospital, ctx.hospitalId, "payer.manage");
  const canManageClaims = canAtHospital(actor.rolesByHospital, ctx.hospitalId, "claim.manage");
  if (!canManagePayers && !canManageClaims) throw new AuthorizationError("claim.manage");
  return {
    payers: await listPayers(ctx.hospitalId),
    coverages: await listPatientCoverages(ctx.hospitalId),
    preAuths: await listPreAuths(ctx.hospitalId),
    claims: await listClaims(ctx.hospitalId),
    canManagePayers,
    canManageClaims,
  };
}

// ---- Payer registry (payer.manage) ----

export async function createPayerForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; kind: string },
) {
  await requireCapability(actor, ctx, "payer.manage", { type: "Payer" });
  const check = validatePayerInput(input);
  if (!check.ok) throw new Error(check.error);
  const code = input.code.trim().toUpperCase();
  if (await findPayerByCode(ctx.hospitalId, code)) throw new Error("Un payeur avec ce code existe déjà dans cet hôpital.");
  const payer = await createPayer({ hospitalId: ctx.hospitalId, code, name: input.name.trim(), kind: input.kind.trim().toUpperCase(), createdById: actor.id });
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.payerCreated, entityType: "Payer", entityId: payer.id, summary: `Payeur créé : ${code} — ${payer.name} (${payer.kind})` });
  return payer;
}

export async function createCoverageProfileForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { payerId: string; code: string; name: string; coveragePercent: number; notes?: string | null },
) {
  await requireCapability(actor, ctx, "payer.manage", { type: "CoverageProfile" });
  const check = validateCoverageProfileInput(input);
  if (!check.ok) throw new Error(check.error);
  const payer = await findPayerById(ctx.hospitalId, input.payerId);
  if (!payer) throw new Error("Payeur introuvable dans cet hôpital.");
  const code = input.code.trim().toUpperCase();
  if (await findCoverageProfileByCode(ctx.hospitalId, code)) throw new Error("Un profil avec ce code existe déjà dans cet hôpital.");
  const profile = await createCoverageProfile({ hospitalId: ctx.hospitalId, payerId: payer.id, code, name: input.name.trim(), coveragePercent: input.coveragePercent, notes: input.notes?.trim() || null });
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.payerUpdated, entityType: "CoverageProfile", entityId: profile.id, summary: `Profil de couverture ${code} (${input.coveragePercent}% placeholder) pour ${payer.code}` });
  return profile;
}

// ---- Patient coverage + eligibility placeholder (claim.manage) ----

export async function linkPatientCoverageForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { patientId: string; payerId: string; coverageProfileId?: string | null; memberNumber: string },
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "PatientCoverage" });
  const check = validateCoverageLinkInput(input);
  if (!check.ok) throw new Error(check.error);
  const patient = await findPatientForCoverage(ctx.hospitalId, input.patientId);
  if (!patient) throw new Error("Patient introuvable dans cet hôpital.");
  const payer = await findPayerById(ctx.hospitalId, input.payerId);
  if (!payer) throw new Error("Payeur introuvable dans cet hôpital.");
  // A profile, if supplied, must belong to this payer in this hospital (no cross-payer / cross-hospital link).
  const coverageProfileId = input.coverageProfileId?.trim() || null;
  if (coverageProfileId && !payer.profiles.some((p) => p.id === coverageProfileId)) {
    throw new Error("Profil de couverture introuvable pour ce payeur dans cet hôpital.");
  }
  const coverage = await createPatientCoverage({
    hospitalId: ctx.hospitalId,
    patientId: patient.id,
    payerId: payer.id,
    coverageProfileId,
    memberNumber: input.memberNumber.trim(),
    createdById: actor.id,
  });
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.coverageLinked, entityType: "PatientCoverage", entityId: coverage.id, summary: `Couverture liée — patient ${patient.patientNumber} au payeur ${payer.code} (adhérent ${coverage.memberNumber})` });
  return coverage;
}

export async function setEligibilityPlaceholderForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  coverageId: string,
  eligibilityStatus: EligibilityStatusCode,
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "PatientCoverage", id: coverageId });
  const coverage = await findPatientCoverageById(ctx.hospitalId, coverageId);
  if (!coverage) throw new Error("Couverture introuvable dans cet hôpital.");
  await setPatientCoverageEligibility(ctx.hospitalId, coverageId, eligibilityStatus);
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.coverageLinked, entityType: "PatientCoverage", entityId: coverageId, summary: `Éligibilité (placeholder) → ${eligibilityStatus} — aucune vérification assureur réelle` });
  return findPatientCoverageById(ctx.hospitalId, coverageId);
}

// ---- Pre-authorization (manual) ----

export async function requestPreAuthForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { patientCoverageId: string; encounterId?: string | null; description: string },
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "PreAuthorizationRequest" });
  if (!input.description?.trim()) throw new Error("La description de la demande d'accord préalable est obligatoire.");
  const coverage = await findPatientCoverageById(ctx.hospitalId, input.patientCoverageId);
  if (!coverage) throw new Error("Couverture introuvable dans cet hôpital.");
  const preAuth = await createPreAuth({ hospitalId: ctx.hospitalId, patientCoverageId: coverage.id, encounterId: input.encounterId?.trim() || null, description: input.description.trim(), requestedById: actor.id });
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.preauthRequested, entityType: "PreAuthorizationRequest", entityId: preAuth.id, summary: `Accord préalable demandé (manuel) — ${input.description.trim()}` });
  return preAuth;
}

export async function decidePreAuthForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: { decision: "approve" | "reject"; reason?: string | null },
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "PreAuthorizationRequest", id });
  const count = await decidePreAuthTx(ctx.hospitalId, id, {
    status: input.decision === "approve" ? "APPROVED" : "REJECTED",
    decidedById: actor.id,
    decisionReason: input.reason?.trim() || null,
  });
  if (count === 0) throw new Error("Cette demande a déjà été décidée (ou n'est pas au statut demandé).");
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.preauthDecided, entityType: "PreAuthorizationRequest", entityId: id, summary: `Accord préalable ${input.decision === "approve" ? "APPROUVÉ" : "REJETÉ"} (manuel) — ${input.reason?.trim() || "sans motif"}` });
  return findPreAuthById(ctx.hospitalId, id);
}

// ---- Claim drafts (manual; billing-linked) ----

export async function createClaimDraftForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { patientCoverageId: string; invoiceId?: string | null; amountClaimed: number },
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "ClaimDraft" });
  if (!Number.isInteger(input.amountClaimed) || input.amountClaimed <= 0) throw new Error("Le montant réclamé doit être un entier positif (FCFA).");
  const coverage = await findPatientCoverageById(ctx.hospitalId, input.patientCoverageId);
  if (!coverage) throw new Error("Couverture introuvable dans cet hôpital.");
  const invoiceId = input.invoiceId?.trim() || null;
  if (invoiceId) {
    const invoice = await findInvoiceById(ctx.hospitalId, invoiceId);
    if (!invoice) throw new Error("Facture introuvable dans cet hôpital.");
    // Billing-linked integrity: the invoice must belong to the SAME patient as the coverage.
    if (invoice.encounter.patientId !== coverage.patientId) {
      throw new Error("La facture concerne un autre patient que la couverture — lien refusé.");
    }
  }

  const year = new Date().getFullYear();
  // Deterministic per-hospital claim number with a small unique-collision retry.
  let claim;
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = (await countClaimsForHospital(ctx.hospitalId)) + 1 + attempt;
    const claimNumber = `${ctx.code}-CLM-${year}-${String(seq).padStart(4, "0")}`;
    try {
      claim = await createClaimDraft({ hospitalId: ctx.hospitalId, patientCoverageId: coverage.id, invoiceId, claimNumber, amountClaimed: input.amountClaimed, createdById: actor.id });
      break;
    } catch {
      if (attempt === 4) throw new Error("Impossible de générer un numéro de dossier unique.");
    }
  }
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.claimDraftCreated, entityType: "ClaimDraft", entityId: claim!.id, summary: `Brouillon de dossier ${claim!.claimNumber} créé — ${formatFcfa(input.amountClaimed)} (manuel)` });
  return claim!;
}

export async function transitionClaimForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  to: ClaimStatusCode,
) {
  await requireCapability(actor, ctx, "claim.manage", { type: "ClaimDraft", id });
  const claim = await findClaimById(ctx.hospitalId, id);
  if (!claim) throw new Error("Dossier introuvable dans cet hôpital.");
  if (!canTransitionClaim(claim.status as ClaimStatusCode, to)) {
    throw new Error(`Transition de dossier invalide (${claim.status} → ${to}).`);
  }
  const count = await transitionClaimStatus(ctx.hospitalId, id, { from: claim.status as ClaimStatusCode, to, decidedById: actor.id });
  if (count === 0) throw new Error("Le statut du dossier a changé — réessayez.");
  await recordAudit({ hospitalId: ctx.hospitalId, actorId: actor.id, action: AUDIT_ACTIONS.claimStatusChanged, entityType: "ClaimDraft", entityId: id, summary: `Dossier ${claim.claimNumber} → ${to} (manuel, aucune soumission automatique)` });
  return findClaimById(ctx.hospitalId, id);
}
