"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  cancelMockPayment,
  confirmMockPayment,
  createMockPaymentIntent,
  createPaymentProviderForActor,
  failMockPayment,
  reconcileExternalPayment,
} from "@/server/services";

const PATH = "/facturation/paiements-externes";

export type PaymentFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): PaymentFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function createProviderAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createPaymentProviderForActor(actor, hospital, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      channel: String(formData.get("channel") ?? "MOBILE_MONEY"),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Prestataire créé (fictif)." };
}

export async function createIntentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createMockPaymentIntent(actor, hospital, {
      providerId: String(formData.get("providerId") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      externalReference: String(formData.get("externalReference") ?? ""),
      invoiceId: String(formData.get("invoiceId") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Intention de paiement créée (fictive)." };
}

export async function paymentActionByDecision(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  try {
    if (decision === "confirm") await confirmMockPayment(actor, hospital, id);
    else if (decision === "fail") await failMockPayment(actor, hospital, id);
    else if (decision === "cancel") await cancelMockPayment(actor, hospital, id);
    else if (decision === "reconcile") await reconcileExternalPayment(actor, hospital, id);
    else return { error: "Action inconnue." };
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Action effectuée." };
}
