"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { receiveStockBatch, releaseStaleReservations } from "@/server/services";

/** Phase 2D-3/2D-4 — receive a stock batch + the 48h reservation-release sweep (pharmacy). */

export type StockFormState = { error?: string; ok?: boolean; message?: string };

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
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Phase 2D-4 — release stale (48h non-collection) reservations back to the shelf. */
export async function releaseStaleReservationsAction(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  let result: { count: number; released: number };
  try {
    result = await releaseStaleReservations(actor, hospital);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(PATH);
  return { ok: true, message: `${result.count}` };
}
