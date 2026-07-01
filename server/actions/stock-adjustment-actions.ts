"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  approveStockAdjustment,
  rejectStockAdjustment,
  requestStockAdjustment,
} from "@/server/services";
import type { StockAdjustmentTypeValue } from "@/lib/stock-adjustment";

/** Phase 2D-7 — stock-adjustment actions (pharmacist requests; Pharmacist-in-Charge decides). */

export type AdjustmentFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function requestAdjustmentAction(
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const batchId = ((formData.get("batchId") as string) ?? "").trim();
  const type = ((formData.get("type") as string) ?? "") as StockAdjustmentTypeValue;
  // Number (not parseInt) so a non-integer like "2.5" stays non-integer and is REJECTED by
  // validateAdjustmentInput, rather than being silently truncated to 2.
  const quantity = Number((formData.get("quantity") as string) ?? "");
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!batchId) return { error: "Veuillez choisir un lot." };
  try {
    await requestStockAdjustment(actor, hospital, { batchId, type, quantity, reason });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/pharmacie/stock");
  revalidatePath("/pharmacie/ajustements");
  return { ok: true };
}

export async function approveAdjustmentAction(
  id: string,
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const decisionReason = ((formData.get("decisionReason") as string) ?? "").trim();
  try {
    await approveStockAdjustment(actor, hospital, id, decisionReason || undefined);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/pharmacie/ajustements");
  revalidatePath("/pharmacie/stock");
  return { ok: true };
}

export async function rejectAdjustmentAction(
  id: string,
  _prev: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const decisionReason = ((formData.get("decisionReason") as string) ?? "").trim();
  if (!decisionReason) return { error: "Le motif de rejet est obligatoire." };
  try {
    await rejectStockAdjustment(actor, hospital, id, decisionReason);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/pharmacie/ajustements");
  return { ok: true };
}
