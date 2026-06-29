"use server";

import { redirect } from "next/navigation";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createInvoice,
  getTariffLineSource,
  listTariffs,
  recordPayment,
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

// Phase 2C — direct invoice voiding and the ephemeral shift-close action were superseded by the
// cancellation workflow (`cancellation-actions`) and the persisted Brouillard (`cashier-shift-actions`).

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
