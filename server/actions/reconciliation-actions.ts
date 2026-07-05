"use server";

import { revalidatePath } from "next/cache";

import { userFacingMessage } from "@/lib/errors";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  changeDepositSlipStatus,
  createDepositSlip,
  importSyntheticBankStatement,
  linkPaymentToSlip,
  matchBankLineToSlip,
  unlinkPaymentFromSlip,
} from "@/server/services";

/**
 * Phase 6.6 · Unit 4 — deposit / bank-reconciliation server actions. Thin: auth → service → revalidate.
 * The service enforces RBAC, the §9 validation rules and audit; these actions only shuttle the form data
 * and translate errors to user-facing French messages. Metadata-only — no invoice/payment money write.
 */
export type ReconFormState = { error?: string; ok?: boolean; message?: string };

const OVERVIEW = "/facturation/rapprochement";
const DEPOSIT_STATUSES = ["prepared", "deposited", "cleared", "disputed"] as const;

function fail(error: unknown): ReconFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function createSlipAction(_prev: ReconFormState, formData: FormData): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const declaredTotalFcfa = Number(formData.get("declaredTotalFcfa"));
  const note = formData.get("note");
  try {
    await createDepositSlip(actor, hospital, {
      declaredTotalFcfa,
      note: note ? String(note) : null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(OVERVIEW);
  return { ok: true, message: "Bordereau de versement créé." };
}

export async function importStatementAction(_prev: ReconFormState, _formData: FormData): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const r = await importSyntheticBankStatement(actor, hospital);
    revalidatePath(OVERVIEW);
    return { ok: true, message: `Relevé bancaire synthétique importé (${r.count} lignes).` };
  } catch (error) {
    return fail(error);
  }
}

export async function linkPaymentAction(
  slipId: string,
  _prev: ReconFormState,
  formData: FormData,
): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const paymentId = String(formData.get("paymentId") ?? "");
  try {
    await linkPaymentToSlip(actor, hospital, { slipId, paymentId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${OVERVIEW}/${slipId}`);
  revalidatePath(OVERVIEW);
  return { ok: true };
}

export async function unlinkPaymentAction(
  slipId: string,
  paymentId: string,
  _prev: ReconFormState,
  _formData: FormData,
): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await unlinkPaymentFromSlip(actor, hospital, { slipId, paymentId });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${OVERVIEW}/${slipId}`);
  revalidatePath(OVERVIEW);
  return { ok: true };
}

export async function matchBankLineAction(
  slipId: string,
  _prev: ReconFormState,
  formData: FormData,
): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const bankLineId = String(formData.get("bankLineId") ?? "");
  const matchedAmountFcfa = Number(formData.get("matchedAmountFcfa"));
  try {
    await matchBankLineToSlip(actor, hospital, { slipId, bankLineId, matchedAmountFcfa });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${OVERVIEW}/${slipId}`);
  revalidatePath(OVERVIEW);
  return { ok: true };
}

export async function changeStatusAction(
  slipId: string,
  to: string,
  _prev: ReconFormState,
  _formData: FormData,
): Promise<ReconFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const target = DEPOSIT_STATUSES.find((s) => s === to);
  if (!target) return { error: "Statut invalide." };
  try {
    await changeDepositSlipStatus(actor, hospital, { slipId, to: target });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${OVERVIEW}/${slipId}`);
  revalidatePath(OVERVIEW);
  return { ok: true };
}
