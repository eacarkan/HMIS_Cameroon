import type { PaymentMethod } from "@prisma/client";

import { PAYMENT_METHOD_FR } from "@/lib/constants";
import { formatFcfa, lineTotalFcfa, sumFcfa } from "@/lib/money";
import {
  createInvoiceWithItems,
  createPayment,
  findEncounterById,
  findInvoiceById,
  updateInvoiceStatus,
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
  input: { amount: number; method: PaymentMethod },
) {
  await requireCapability(actor, ctx, "payment.record");

  const invoice = await findInvoiceById(ctx.hospitalId, invoiceId);
  if (!invoice) throw new Error("Facture introuvable dans cet hôpital.");

  const { remaining } = invoiceBalance(invoice);
  if (input.amount <= 0 || input.amount > remaining) {
    throw new Error("Montant invalide.");
  }

  const year = new Date().getFullYear();
  const receiptNumber = await generateNumber(ctx, "receipt", year);

  const payment = await createPayment({
    hospitalId: ctx.hospitalId,
    invoiceId,
    receiptNumber,
    amount: input.amount,
    method: input.method,
    status: "recorded",
    cashierId: actor.id,
    createdById: actor.id,
  });

  const status = remaining - input.amount <= 0 ? "paid" : "partially_paid";
  await updateInvoiceStatus(ctx.hospitalId, invoiceId, status);

  const methodFr = PAYMENT_METHOD_FR[input.method] ?? input.method;
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.paymentRecord,
    entityType: "Payment",
    entityId: payment.id,
    summary: `Paiement enregistré (${formatFcfa(input.amount)}, ${methodFr})`,
  });

  return payment;
}
