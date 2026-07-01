import {
  createExternalPaymentProvider,
  createExternalPaymentTransaction,
  findExternalPaymentProviderByCode,
  findExternalPaymentProviderById,
  findExternalPaymentTransactionById,
  findExternalPaymentTransactionByReference,
  findInvoiceById,
  linkReconciledPayment,
  listExternalPaymentProviders,
  listExternalPaymentTransactions,
  transitionExternalPaymentStatus,
  type HospitalContext,
} from "@/server/db";
import {
  canConfirm,
  canFailOrCancel,
  canReconcile,
  validateProviderInput,
  validateTransactionInput,
} from "@/lib/external-payment";
import { isLiveIntegrationEnabled, resolveConnectorAdapter } from "@/lib/integration";
import { formatFcfa } from "@/lib/money";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { recordPayment } from "./billing-service";

/**
 * Payment-provider abstraction service (Phase 4D). A registry of MOCK payment providers + external
 * transactions with an audited status machine. A confirmation runs through the 4A mock connector (NO
 * network) and NEVER touches the invoice. RECONCILIATION records a CONTROLLED Payment through the
 * EXISTING billing rule (`recordPayment`) — which preserves the Phase 2C invoice snapshots + audit and
 * validates the amount — never a direct invoice write. Finance-gated; hospital-scoped; integer FCFA.
 * No real provider API; no production payment.
 */

export async function getExternalPaymentAdmin(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "external_payment.view");
  return {
    providers: await listExternalPaymentProviders(ctx.hospitalId),
    transactions: await listExternalPaymentTransactions(ctx.hospitalId, { limit: 30 }),
  };
}

export async function createPaymentProviderForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; channel: string },
) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentProvider" });
  const check = validateProviderInput(input);
  if (!check.ok) throw new Error(check.error);
  const code = input.code.trim().toUpperCase();
  if (await findExternalPaymentProviderByCode(ctx.hospitalId, code)) {
    throw new Error("Un prestataire avec ce code existe déjà dans cet hôpital.");
  }
  const provider = await createExternalPaymentProvider({
    hospitalId: ctx.hospitalId,
    code,
    name: input.name.trim(),
    channel: input.channel.trim().toUpperCase(),
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.externalPaymentCreated,
    entityType: "ExternalPaymentProvider",
    entityId: provider.id,
    summary: `Prestataire de paiement FICTIF créé : ${code} (${provider.channel})`,
  });
  return provider;
}

export async function createMockPaymentIntent(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { providerId: string; amount: number; externalReference: string; invoiceId?: string | null; payerRef?: string | null },
) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentTransaction" });
  const check = validateTransactionInput(input);
  if (!check.ok) throw new Error(check.error);
  const provider = await findExternalPaymentProviderById(ctx.hospitalId, input.providerId);
  if (!provider) throw new Error("Prestataire introuvable dans cet hôpital.");
  const externalReference = input.externalReference.trim();
  if (await findExternalPaymentTransactionByReference(ctx.hospitalId, externalReference)) {
    throw new Error("Une transaction avec cette référence existe déjà (référence unique).");
  }
  const txn = await createExternalPaymentTransaction({
    hospitalId: ctx.hospitalId,
    providerId: provider.id,
    externalReference,
    amount: input.amount,
    invoiceId: input.invoiceId?.trim() || null,
    payerRef: input.payerRef?.trim() || null,
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.externalPaymentCreated,
    entityType: "ExternalPaymentTransaction",
    entityId: txn.id,
    summary: `Intention de paiement FICTIVE créée — ${formatFcfa(input.amount)} (${provider.code}, réf ${externalReference})`,
  });
  return txn;
}

async function transitionForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  to: "CONFIRMED" | "FAILED" | "CANCELLED",
) {
  const txn = await findExternalPaymentTransactionById(ctx.hospitalId, id);
  if (!txn) throw new Error("Transaction introuvable dans cet hôpital.");
  const status = txn.status as "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";
  if (to === "CONFIRMED" && !canConfirm(status)) throw new Error("Seule une transaction EN ATTENTE peut être confirmée.");
  if ((to === "FAILED" || to === "CANCELLED") && !canFailOrCancel(status)) {
    throw new Error("Seule une transaction EN ATTENTE peut être échouée/annulée.");
  }
  if (to === "CONFIRMED") {
    // The mock provider "confirms" via the 4A mock connector — NO network, and it NEVER touches the invoice.
    const adapter = resolveConnectorAdapter("MOCK", { liveEnabled: isLiveIntegrationEnabled() });
    await adapter.run({ jobKind: "PAYMENT_CONFIRM", payload: { reference: txn.externalReference } });
  }
  const count = await transitionExternalPaymentStatus(ctx.hospitalId, id, { from: "PENDING", to });
  if (count === 0) throw new Error("La transaction n'est plus en attente.");
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.externalPaymentStatusChanged,
    entityType: "ExternalPaymentTransaction",
    entityId: id,
    summary: `Transaction ${txn.externalReference} → ${to} (fictif, aucun mouvement de facture)`,
  });
  return findExternalPaymentTransactionById(ctx.hospitalId, id);
}

export async function confirmMockPayment(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentTransaction", id });
  return transitionForActor(actor, ctx, id, "CONFIRMED");
}

export async function failMockPayment(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentTransaction", id });
  return transitionForActor(actor, ctx, id, "FAILED");
}

export async function cancelMockPayment(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentTransaction", id });
  return transitionForActor(actor, ctx, id, "CANCELLED");
}

/**
 * Reconcile a CONFIRMED external transaction against its invoice. THE GUARANTEE: this NEVER silently
 * marks the invoice paid or rewrites history — it records a CONTROLLED Payment through the EXISTING
 * `recordPayment` billing rule (which preserves the invoice snapshots + audit and validates the amount),
 * then links that Payment id to the transaction. If the payment cannot be recorded, nothing is linked.
 */
export async function reconcileExternalPayment(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "external_payment.reconcile", { type: "ExternalPaymentTransaction", id });
  const txn = await findExternalPaymentTransactionById(ctx.hospitalId, id);
  if (!txn) throw new Error("Transaction introuvable dans cet hôpital.");
  if (!canReconcile(txn.status as "CONFIRMED", txn.reconciledPaymentId)) {
    throw new Error("Seule une transaction CONFIRMÉE et non encore rapprochée peut être rapprochée.");
  }
  if (!txn.invoiceId) throw new Error("Aucune facture associée — rapprochement impossible.");
  const invoice = await findInvoiceById(ctx.hospitalId, txn.invoiceId);
  if (!invoice) throw new Error("Facture introuvable dans cet hôpital.");

  // Record the payment through the EXISTING controlled billing rule (snapshots + audit + amount check).
  const payment = await recordPayment(actor, ctx, txn.invoiceId, { amount: txn.amount, method: "mobile_money" });

  const count = await linkReconciledPayment(ctx.hospitalId, id, payment.id);
  if (count === 0) throw new Error("La transaction a déjà été rapprochée.");
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.externalPaymentReconciled,
    entityType: "ExternalPaymentTransaction",
    entityId: id,
    summary: `Transaction ${txn.externalReference} rapprochée → paiement contrôlé ${formatFcfa(txn.amount)} sur facture ${invoice.invoiceNumber} (règle existante)`,
  });
  return { transaction: await findExternalPaymentTransactionById(ctx.hospitalId, id), paymentId: payment.id };
}
