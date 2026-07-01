import {
  accrueEmergencyDebtTx,
  decideEmergencyDebt,
  findEmergencyDebtById,
  findEncounterById,
  listEmergencyDebtsForEncounter,
  setEncounterEmergency,
  unflagEncounterEmergencyTx,
  type HospitalContext,
} from "@/server/db";
import { canDecideEmergencyDebt, sumOutstandingEmergencyDebt, validateEmergencyDebtInput } from "@/lib/emergency";
import { formatFcfa } from "@/lib/money";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Emergency-exception service (Phase 2H). A triage nurse/doctor flags an encounter as emergency
 * ("treat first, pay later") — which lets dispensing bypass the cashier paid-check (2D-5) — and charges
 * accrue as an auditable Emergency Debt ledger. Debt is settled by the cashier or WAIVED by the Hospital
 * Director (mandatory reason). An encounter cannot be un-flagged while it still has outstanding debt, and
 * (2G) cannot be discharged with outstanding debt. Hospital-scoped; every action audited.
 */

export async function flagEncounterEmergency(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
  isEmergency: boolean,
) {
  await requireCapability(actor, ctx, "emergency.flag", { type: "Encounter", id: encounterId });
  const encounter = await findEncounterById(ctx.hospitalId, encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  if (isEmergency) {
    await setEncounterEmergency(ctx.hospitalId, encounterId, true, actor.id);
  } else {
    // Un-flag is ATOMIC (server/db): it locks the encounter row, re-counts outstanding debt under that
    // lock, then clears the flag — serialised with `accrueEmergencyDebtTx` so a concurrent accrual can
    // never leave the encounter non-emergency WITH outstanding debt. Throws if debt is still outstanding.
    await unflagEncounterEmergencyTx({ hospitalId: ctx.hospitalId, encounterId });
  }
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.emergencyFlagged,
    entityType: "Encounter",
    entityId: encounterId,
    summary: `Visite ${encounter.encounterNumber} ${isEmergency ? "marquée URGENCE" : "urgence retirée"}`,
  });
  return findEncounterById(ctx.hospitalId, encounterId);
}

export async function accrueEmergencyDebt(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { encounterId: string; amount: number; source: string },
) {
  await requireCapability(actor, ctx, "emergency.debt.accrue", { type: "Encounter", id: input.encounterId });
  const check = validateEmergencyDebtInput(input);
  if (!check.ok) throw new Error(check.error);
  const encounter = await findEncounterById(ctx.hospitalId, input.encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");
  if (!encounter.isEmergency) {
    throw new Error("La dette d'urgence ne peut être enregistrée que sur une visite marquée urgence.");
  }
  // Atomic accrual (server/db): a guarded `updateMany(where isEmergency:true)` re-asserts the flag AND
  // locks the encounter row before the debt row is inserted — serialised with `unflagEncounterEmergencyTx`.
  // The pre-check above is just a fast/clear UX failure; this is the authoritative guard.
  const debt = await accrueEmergencyDebtTx({
    hospitalId: ctx.hospitalId,
    encounterId: encounter.id,
    patientId: encounter.patientId,
    amount: input.amount,
    source: input.source.trim(),
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.emergencyDebtAccrued,
    entityType: "EmergencyDebt",
    entityId: debt.id,
    summary: `Dette d'urgence ${formatFcfa(input.amount)} (${input.source.trim()}) — visite ${encounter.encounterNumber}`,
  });
  return debt;
}

export async function settleEmergencyDebt(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "emergency.debt.settle", { type: "EmergencyDebt", id });
  const debt = await findEmergencyDebtById(ctx.hospitalId, id);
  if (!debt) throw new Error("Dette d'urgence introuvable dans cet hôpital.");
  if (!canDecideEmergencyDebt(debt.status)) throw new Error("Cette dette d'urgence a déjà été traitée.");
  const updated = await decideEmergencyDebt({ hospitalId: ctx.hospitalId, id, status: "settled", decidedById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.emergencyDebtSettled,
    entityType: "EmergencyDebt",
    entityId: id,
    summary: `Dette d'urgence réglée — ${formatFcfa(debt.amount)} (${debt.source})`,
  });
  return updated;
}

export async function waiveEmergencyDebt(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  reason: string,
) {
  await requireCapability(actor, ctx, "emergency.debt.waive", { type: "EmergencyDebt", id });
  if (!reason?.trim()) throw new Error("Le motif d'annulation (Directeur) est obligatoire.");
  const debt = await findEmergencyDebtById(ctx.hospitalId, id);
  if (!debt) throw new Error("Dette d'urgence introuvable dans cet hôpital.");
  if (!canDecideEmergencyDebt(debt.status)) throw new Error("Cette dette d'urgence a déjà été traitée.");
  const updated = await decideEmergencyDebt({
    hospitalId: ctx.hospitalId,
    id,
    status: "waived",
    decidedById: actor.id,
    decisionReason: reason.trim(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.emergencyDebtWaived,
    entityType: "EmergencyDebt",
    entityId: id,
    summary: `Dette d'urgence ANNULÉE par le Directeur — ${formatFcfa(debt.amount)} (${debt.source}) — motif : ${reason.trim()}`,
  });
  return updated;
}

export async function getEmergencyDebtSummary(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
) {
  await requireCapability(actor, ctx, "emergency.debt.read");
  const entries = await listEmergencyDebtsForEncounter(ctx.hospitalId, encounterId);
  const outstandingTotal = sumOutstandingEmergencyDebt(entries);
  return { entries, outstandingTotal, hasOutstanding: outstandingTotal > 0 };
}
