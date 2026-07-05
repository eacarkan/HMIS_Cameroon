import type { PaymentMethod } from "@prisma/client";

import { PAYMENT_METHOD_FR } from "@/lib/constants";
import { formatFcfa, lineTotalFcfa, sumFcfa } from "@/lib/money";
import {
  createInvoiceWithItems,
  findEncounterById,
  findInvoiceById,
  findTariffByCode,
  recordPaymentTx,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/** Billing service (06 §12, 09 §4). Integer FCFA; the invoice is the single source of
 * truth for amounts — payments reconcile against it. */

export type InvoiceLineInput = {
  label: string;
  unitAmount: number;
  quantity: number;
};

/** Paid-so-far and remaining for an invoice (recorded payments only). */
export function invoiceBalance(invoice: {
  totalAmount: number;
  payments: { amount: number; status: string }[];
}) {
  const paid = sumFcfa(
    invoice.payments
      .filter((p) => p.status === "recorded")
      .map((p) => p.amount),
  );
  return { paid, remaining: invoice.totalAmount - paid };
}

export async function getInvoice(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "invoice.read");
  return findInvoiceById(ctx.hospitalId, id);
}

export async function createInvoice(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  encounterId: string,
  lines: InvoiceLineInput[],
) {
  await requireCapability(actor, ctx, "invoice.create");

  const encounter = await findEncounterById(ctx.hospitalId, encounterId);
  if (!encounter) throw new Error("Visite introuvable dans cet hôpital.");

  const valid = lines.filter((l) => l.quantity > 0);
  if (valid.length === 0)
    throw new Error("Sélectionnez au moins une prestation.");

  const items = valid.map((l) => ({
    label: l.label,
    quantity: l.quantity,
    unitAmount: l.unitAmount,
    lineTotal: lineTotalFcfa(l.unitAmount, l.quantity),
  }));
  const total = sumFcfa(items.map((i) => i.lineTotal));

  const year = new Date().getFullYear();
  const invoiceNumber = await generateNumber(ctx, "invoice", year);

  const invoice = await createInvoiceWithItems({
    hospitalId: ctx.hospitalId,
    encounterId,
    invoiceNumber,
    status: "issued",
    totalAmount: total,
    items,
    createdById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.invoiceCreate,
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Création de la facture ${invoice.invoiceNumber} (${formatFcfa(total)})`,
  });

  return invoice;
}

export async function recordPayment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  invoiceId: string,
  input: {
    amount: number;
    method: PaymentMethod;
    // Phase 6.6 — optional Mobile-Money operator/reference snapshot; kept ONLY for method = mobile_money.
    mobileMoneyOperator?: string | null;
    mobileMoneyReference?: string | null;
  },
) {
  await requireCapability(actor, ctx, "payment.record");

  // Fast, non-authoritative pre-check for a clear UX failure (missing invoice / obviously-invalid amount).
  // The AUTHORITATIVE guard runs inside `recordPaymentTx` under a row lock (F-01).
  const invoice = await findInvoiceById(ctx.hospitalId, invoiceId);
  if (!invoice) throw new Error("Facture introuvable dans cet hôpital.");
  const { remaining } = invoiceBalance(invoice);
  if (input.amount <= 0 || input.amount > remaining) {
    throw new Error("Montant invalide.");
  }

  const year = new Date().getFullYear();
  const receiptNumber = await generateNumber(ctx, "receipt", year);

  // Phase 6.6 — the Mobile-Money snapshot is retained ONLY for a mobile_money payment (cash / card /
  // transfer never carry an operator or reference). Trimmed; empty strings collapse to null.
  const isMomo = input.method === "mobile_money";
  const mobileMoneyOperator = isMomo ? input.mobileMoneyOperator?.trim() || null : null;
  const mobileMoneyReference = isMomo ? input.mobileMoneyReference?.trim() || null : null;

  // ATOMIC (F-01): lock the invoice, re-derive `remaining` from authoritative recorded payments inside
  // the lock, reject an over-amount, then create the payment + update the invoice status together. A
  // stale pre-read can no longer authorise a concurrent double-payment / overpayment.
  const { payment } = await recordPaymentTx({
    hospitalId: ctx.hospitalId,
    invoiceId,
    receiptNumber,
    amount: input.amount,
    method: input.method,
    cashierId: actor.id,
    createdById: actor.id,
    mobileMoneyOperator,
    mobileMoneyReference,
  });

  const methodFr = PAYMENT_METHOD_FR[input.method] ?? input.method;
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.paymentRecord,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Paiement enregistré (${formatFcfa(input.amount)}, ${methodFr}${mobileMoneyOperator ? ` — ${mobileMoneyOperator}` : ""})`,
  });

  return payment;
}

/**
 * Phase 2C — direct invoice voiding was REPLACED by the controlled cancellation workflow
 * (`cancellation-service`): a cashier REQUESTS a cancellation (mandatory reason) and a Hospital
 * Administrator APPROVES it (cashier ≠ approver), spawning a RefundVoucher for paid invoices.
 * The cancel mechanics (set invoice `cancelled`, cancel recorded payments — snapshots untouched)
 * now live in `approveInvoiceCancellation`.
 */

/**
 * Tariff-as-source helper (Gate 3, 23 §5 — SOURCE ONLY). The cashier resolves a tariff
 * (by code, hospital-scoped) into an invoice line input. It is a READ-ONLY reference: it
 * returns the values to snapshot at `createInvoice` time and NEVER mutates a tariff or an
 * existing InvoiceItem — later tariff changes can't alter historical invoices. Integer
 * FCFA. Requires `tariff.use`; audits `invoice_item.tariff_source_used`.
 */
export async function getTariffLineSource(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  tariffCode: string,
  quantity = 1,
): Promise<InvoiceLineInput> {
  await requireCapability(actor, ctx, "tariff.use", { type: "Tariff" });

  const tariff = await findTariffByCode(ctx.hospitalId, tariffCode);
  if (!tariff || !tariff.isActive) {
    throw new Error("Tarif introuvable ou inactif dans cet hôpital.");
  }

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.invoiceItemTariffSourceUsed,
    entityType: "Tariff",
    entityId: tariff.id,
    summary: `Tarif utilisé comme source de ligne : ${tariff.label} (${formatFcfa(tariff.amount)})`,
  });

  // A plain snapshot input — createInvoice will freeze these onto the InvoiceItem.
  return { label: tariff.label, unitAmount: tariff.amount, quantity };
}
