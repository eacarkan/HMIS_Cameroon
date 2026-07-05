import type { DepositSlipStatus } from "@prisma/client";

import {
  assertBankLineMatch,
  assertDepositSlipTransition,
  assertSameHospital,
  bankLineMatchStatusFor,
  depositSlipReconciles,
} from "@/lib/finance";
import { formatFcfa } from "@/lib/money";
import {
  createBankReconciliationMatchRow,
  createBankStatementLines,
  createDepositSlipPaymentRow,
  createDepositSlipRow,
  deleteDepositSlipPaymentRow,
  findBankStatementLineById,
  findDepositSlipById,
  findRecordedPaymentForLink,
  isPaymentOnActiveSlip,
  listBankStatementLines,
  listDepositSlips,
  listRecordedPaymentsNotOnSlip,
  recomputeDepositSlipTotals,
  recomputeSlipClearedAmount,
  setBankLineMatchStatusRow,
  setDepositSlipStatusRow,
  sumMatchedForBankLine,
  type HospitalContext,
} from "@/server/db";

import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { generateNumber } from "./numbering-service";

/**
 * Phase 6.6 · Unit 4 — deposit / bank reconciliation service (hospital-scoped; audited). THE GUARANTEE:
 * every operation is a METADATA overlay — it never writes an Invoice/Payment money field, status or
 * receipt (money recording stays recordPayment → recordPaymentTx, F-01). Enforces the Step-0 §9 rules via
 * lib/finance: cross-hospital rejection, no over-matching a bank line, one active slip per payment, the
 * prepared→deposited→cleared transitions, and cleared-only-when-reconciled.
 */

// ---------------------------------------- reads (reconciliation.view) ----------------------------------------

export async function getReconciliationOverview(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "reconciliation.view");
  const [slips, bankLines] = await Promise.all([
    listDepositSlips(ctx.hospitalId),
    listBankStatementLines(ctx.hospitalId),
  ]);
  return { slips, bankLines };
}

export async function getDepositSlipDetail(actor: AuthenticatedActor, ctx: HospitalContext, slipId: string) {
  await requireCapability(actor, ctx, "reconciliation.view");
  const slip = await findDepositSlipById(ctx.hospitalId, slipId);
  if (!slip) throw new Error("Bordereau introuvable dans cet hôpital.");
  const [availablePayments, bankLines] = await Promise.all([
    listRecordedPaymentsNotOnSlip(ctx.hospitalId),
    listBankStatementLines(ctx.hospitalId),
  ]);
  return { slip, availablePayments, bankLines };
}

// ------------------------------------- writes (reconciliation.manage) -------------------------------------

export async function createDepositSlip(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { declaredTotalFcfa: number; depositDate?: Date; note?: string | null },
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "DepositSlip" });
  const declared = Math.trunc(input.declaredTotalFcfa);
  if (!Number.isFinite(declared) || declared < 0) throw new Error("Montant déclaré invalide (entier FCFA ≥ 0).");

  const slipNumber = await generateNumber(ctx, "deposit_slip", new Date().getFullYear());
  const slip = await createDepositSlipRow({
    hospitalId: ctx.hospitalId,
    slipNumber,
    depositDate: input.depositDate ?? new Date(),
    declaredTotalFcfa: declared,
    note: input.note ?? null,
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.depositSlipCreated,
    entityType: "DepositSlip",
    entityId: slip.id,
    summary: `Bordereau de versement ${slipNumber} créé (déclaré ${formatFcfa(declared)})`,
  });
  return slip;
}

export async function linkPaymentToSlip(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { slipId: string; paymentId: string },
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "DepositSlip", id: input.slipId });
  const slip = await findDepositSlipById(ctx.hospitalId, input.slipId);
  if (!slip) throw new Error("Bordereau introuvable dans cet hôpital.");
  if (slip.status === "cleared" || slip.status === "disputed") {
    throw new Error("Bordereau non modifiable (compensé ou en litige).");
  }
  const payment = await findRecordedPaymentForLink(ctx.hospitalId, input.paymentId);
  if (!payment) throw new Error("Paiement introuvable ou non enregistré dans cet hôpital.");
  // Cross-hospital rejection (Step-0 §9) — slip, payment and the acting context must share one hospital.
  assertSameHospital(ctx.hospitalId, slip.hospitalId, payment.hospitalId);
  // One active slip per payment (Step-0 §9) — the DB @@unique backstops this; the guard is the clean error.
  if (await isPaymentOnActiveSlip(ctx.hospitalId, input.paymentId)) {
    throw new Error("Ce paiement figure déjà sur un bordereau actif.");
  }

  await createDepositSlipPaymentRow({
    hospitalId: ctx.hospitalId,
    depositSlipId: input.slipId,
    paymentId: input.paymentId,
    linkedById: actor.id,
  });
  const computed = await recomputeDepositSlipTotals(ctx.hospitalId, input.slipId);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.depositSlipPaymentLinked,
    entityType: "DepositSlip",
    entityId: input.slipId,
    summary: `Paiement rattaché au bordereau ${slip.slipNumber} (total système ${formatFcfa(computed)})`,
  });
  return { computedPaymentTotalFcfa: computed };
}

export async function unlinkPaymentFromSlip(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { slipId: string; paymentId: string },
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "DepositSlip", id: input.slipId });
  const slip = await findDepositSlipById(ctx.hospitalId, input.slipId);
  if (!slip) throw new Error("Bordereau introuvable dans cet hôpital.");
  if (slip.status === "cleared") throw new Error("Bordereau compensé — non modifiable.");

  await deleteDepositSlipPaymentRow(ctx.hospitalId, input.slipId, input.paymentId);
  const computed = await recomputeDepositSlipTotals(ctx.hospitalId, input.slipId);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.depositSlipPaymentUnlinked,
    entityType: "DepositSlip",
    entityId: input.slipId,
    summary: `Paiement détaché du bordereau ${slip.slipNumber} (total système ${formatFcfa(computed)})`,
  });
  return { computedPaymentTotalFcfa: computed };
}

export async function importSyntheticBankStatement(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "BankStatementLine" });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const importBatchId = `BANK-${stamp}`;

  // A SYNTHETIC statement derived from the not-yet-cleared slips (a matching line each) + one deliberate
  // mismatch and one orphan credit — so the reconciliation screen always has real gaps to surface.
  const slips = (await listDepositSlips(ctx.hospitalId)).filter((s) => s.status !== "cleared").slice(0, 6);
  const rows = slips.map((s, i) => ({
    hospitalId: ctx.hospitalId,
    valueDate: new Date(),
    amountFcfa: s.declaredTotalFcfa,
    label: `Versement ${s.slipNumber}`,
    reference: `REL-${importBatchId}-${String(i + 1).padStart(3, "0")}`,
    importBatchId,
    createdById: actor.id,
  }));
  if (slips.length > 0) {
    rows.push({
      hospitalId: ctx.hospitalId, valueDate: new Date(),
      amountFcfa: Math.max(0, slips[0].declaredTotalFcfa - 500),
      label: "Versement — écart de montant", reference: `REL-${importBatchId}-ecart`, importBatchId, createdById: actor.id,
    });
  }
  rows.push({
    hospitalId: ctx.hospitalId, valueDate: new Date(), amountFcfa: 7500,
    label: "Virement entrant non identifié", reference: `REL-${importBatchId}-orphelin`, importBatchId, createdById: actor.id,
  });

  const res = await createBankStatementLines(rows);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.bankStatementImported,
    entityType: "BankStatementLine",
    entityId: importBatchId,
    summary: `Relevé bancaire synthétique importé (${res.count} lignes, lot ${importBatchId})`,
  });
  return { count: res.count, importBatchId };
}

export async function matchBankLineToSlip(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { bankLineId: string; slipId: string; matchedAmountFcfa: number },
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "BankReconciliationMatch" });
  const slip = await findDepositSlipById(ctx.hospitalId, input.slipId);
  if (!slip) throw new Error("Bordereau introuvable dans cet hôpital.");
  const line = await findBankStatementLineById(ctx.hospitalId, input.bankLineId);
  if (!line) throw new Error("Ligne bancaire introuvable dans cet hôpital.");
  // Cross-hospital rejection (Step-0 §9).
  assertSameHospital(ctx.hospitalId, slip.hospitalId, line.hospitalId);

  const amount = Math.trunc(input.matchedAmountFcfa);
  const already = await sumMatchedForBankLine(ctx.hospitalId, input.bankLineId);
  // Rejects a non-positive amount AND over-matching the line (Step-0 §9).
  assertBankLineMatch({ lineAmountFcfa: line.amountFcfa, alreadyMatchedFcfa: already, newMatchAmountFcfa: amount });

  await createBankReconciliationMatchRow({
    hospitalId: ctx.hospitalId,
    bankStatementLineId: input.bankLineId,
    depositSlipId: input.slipId,
    matchedAmountFcfa: amount,
    matchedById: actor.id,
  });
  await setBankLineMatchStatusRow(ctx.hospitalId, input.bankLineId, bankLineMatchStatusFor(line.amountFcfa, already + amount));
  const cleared = await recomputeSlipClearedAmount(ctx.hospitalId, input.slipId);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.bankLineMatched,
    entityType: "BankReconciliationMatch",
    entityId: input.bankLineId,
    summary: `Ligne bancaire rapprochée au bordereau ${slip.slipNumber} (${formatFcfa(amount)})`,
  });
  return { clearedAmountFcfa: cleared };
}

export async function changeDepositSlipStatus(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { slipId: string; to: DepositSlipStatus },
) {
  await requireCapability(actor, ctx, "reconciliation.manage", { type: "DepositSlip", id: input.slipId });
  const slip = await findDepositSlipById(ctx.hospitalId, input.slipId);
  if (!slip) throw new Error("Bordereau introuvable dans cet hôpital.");
  // cleared-only-when-reconciled + no forward skips (Step-0 §9), evaluated with the live cleared amount.
  const reconciles = depositSlipReconciles(slip.declaredTotalFcfa, slip.clearedAmountFcfa);
  assertDepositSlipTransition({ from: slip.status, to: input.to, reconciles });

  await setDepositSlipStatusRow(ctx.hospitalId, input.slipId, { status: input.to, updatedById: actor.id });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.depositSlipStatusChanged,
    entityType: "DepositSlip",
    entityId: input.slipId,
    summary: `Bordereau ${slip.slipNumber} : ${slip.status} → ${input.to}`,
  });
  return { status: input.to };
}
