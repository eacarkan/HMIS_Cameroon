"use server";

import { redirect } from "next/navigation";

import { TARIFFS } from "@/lib/constants";
import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { createInvoice, recordPayment } from "@/server/services";

export type BillingFormState = { error?: string };

const methodSchema = z.enum(["cash", "mobile_money", "card", "bank_transfer"]);

export async function createInvoiceAction(
  encounterId: string,
  _prev: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const { actor, hospital } = await requireActorAndHospital();

  const lines = TARIFFS.map((tariff) => {
    const raw = Number(formData.get(`qty_${tariff.code}`) ?? 0);
    const quantity = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    return { label: tariff.label, unitAmount: tariff.amount, quantity };
  });

  let invoiceId: string;
  try {
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
