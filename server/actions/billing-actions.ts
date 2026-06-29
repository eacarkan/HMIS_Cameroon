"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  closeCashierShift,
  createInvoice,
  getTariffLineSource,
  listTariffs,
  recordPayment,
  voidInvoice,
  type InvoiceLineInput,
} from "@/server/services";

export type BillingFormState = { error?: string; ok?: boolean };

const methodSchema = z.enum(["cash", "mobile_money", "card", "bank_transfer"]);

export async function createInvoiceAction(
  encounterId: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const TARIFF_UNAVAILABLE =
    "Tarif indisponible ou non autorisé. Veuillez actualiser la page.";

  // Line items are sourced ONLY from the active DB tariff catalogue (the same list the
  // form rendered). There is NO static fallback: a missing/inactive/unauthorized tariff
  // returns a clear French error. createInvoice freezes the snapshot (label/qty/amount).
  let activeTariffs: Awaited<ReturnType<typeof listTariffs>>;
  try {
    activeTariffs = (await listTariffs(actor, hospital)).filter((tf) => tf.isActive);
  } catch {
    return { error: TARIFF_UNAVAILABLE };
  }

  let invoiceId: string;
  try {
    const lines: InvoiceLineInput[] = [];
    for (const tf of activeTariffs) {
      const raw = Number(formData.get(`qty_${tf.code}`) ?? 0);
      const quantity = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
      if (quantity <= 0) continue;
      try {
        // Audited `invoice_item.tariff_source_used`.
        lines.push(await getTariffLineSource(actor, hospital, tf.code, quantity));
      } catch {
        return { error: TARIFF_UNAVAILABLE }; // no static fallback
      }
    }
    const invoice = await createInvoice(actor, hospital, encounterId, lines);
    invoiceId = invoice.id;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à créer une facture." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  redirect(`/factures/${invoiceId}`);
}

/** Void / cancel an invoice with a reason (bound: invoiceId). Money-affecting → audited. */
export async function voidInvoiceAction(
  invoiceId: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation est obligatoire." };
  try {
    await voidInvoice(actor, hospital, invoiceId, reason);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à annuler une facture." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/factures/${invoiceId}`);
  return { ok: true };
}

/** Close the current cashier's shift for a date (audited totals by mode). */
export async function closeCashierShiftAction(
  date: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await closeCashierShift(actor, hospital, date || undefined);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à clôturer la caisse." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/rapports-caisse");
  return { ok: true };
}

export async function recordPaymentAction(
  invoiceId: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const amount = Number(formData.get("amount"));
  const method = methodSchema.safeParse(formData.get("method"));
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Montant invalide." };
  }
  if (!method.success) return { error: "Mode de paiement invalide." };

  try {
    await recordPayment(actor, hospital, invoiceId, {
      amount,
      method: method.data,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "Vous n'êtes pas autorisé à encaisser." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  redirect(`/factures/${invoiceId}`);
}
