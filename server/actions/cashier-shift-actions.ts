"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  closeCashierShift,
  correctCashierShift,
  openCashierShift,
} from "@/server/services";

/** Phase 2C — Brouillard de Caisse actions (open / close / correct). */

export type ShiftFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à gérer la caisse.";

/** Open a shift with an opening balance (integer FCFA). */
export async function openShiftAction(
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const raw = Number(formData.get("openingBalance"));
  if (!Number.isInteger(raw) || raw < 0) {
    return { error: "Le fonds de caisse initial doit être un entier positif (FCFA)." };
  }
  try {
    await openCashierShift(actor, hospital, raw);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/caisse/brouillard");
  return { ok: true };
}

/** Close the cashier's own open shift (freezes the five totals). */
export async function closeShiftAction(
  shiftId: string,
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  void formData;
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await closeCashierShift(actor, hospital, shiftId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/caisse/brouillard");
  revalidatePath(`/caisse/brouillard/${shiftId}`);
  return { ok: true };
}

/** Append a controlled correction to a closed Brouillard (frozen figures unchanged). */
export async function correctShiftAction(
  shiftId: string,
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  const note = ((formData.get("note") as string) ?? "").trim();
  if (!reason || !note) return { error: "Le motif et la note de correction sont obligatoires." };
  try {
    await correctCashierShift(actor, hospital, shiftId, reason, note);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/caisse/brouillard/${shiftId}`);
  return { ok: true };
}
