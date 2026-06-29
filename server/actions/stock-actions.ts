"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { receiveStockBatch } from "@/server/services";

/** Phase 2D-3 — receive a medication stock batch (pharmacy). */

export type StockFormState = { error?: string; ok?: boolean };

const PATH = "/pharmacie/stock";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à gérer le stock.";

export async function receiveStockBatchAction(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const quantityRaw = Number(formData.get("quantity"));
  try {
    await receiveStockBatch(actor, hospital, {
      medicationId: (formData.get("medicationId") as string) ?? "",
      batchNumber: (formData.get("batchNumber") as string) ?? "",
      expiryDate: (formData.get("expiryDate") as string) ?? "",
      quantity: Number.isInteger(quantityRaw) ? quantityRaw : NaN,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(PATH);
  return { ok: true };
}
