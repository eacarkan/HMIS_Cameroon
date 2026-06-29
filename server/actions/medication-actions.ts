"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createMedication,
  deactivateMedication,
  reactivateMedication,
} from "@/server/services";
import type { ActionState } from "./config-actions";

/** Phase 2D-1 — medication catalogue actions (Hospital Admin manages; hospital-scoped, audited). */

const PATH = "/administration/medicaments";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à gérer le catalogue des médicaments.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

export async function createMedicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const orderRaw = Number(formData.get("displayOrder"));
  try {
    await createMedication(actor, hospital, {
      code: (formData.get("code") as string) ?? "",
      nameFr: (formData.get("nameFr") as string) ?? "",
      nameEn: (formData.get("nameEn") as string) ?? "",
      form: (formData.get("form") as string) ?? "",
      unit: (formData.get("unit") as string) ?? "",
      strength: (formData.get("strength") as string) || null,
      displayOrder: Number.isInteger(orderRaw) ? orderRaw : 0,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function deactivateMedicationAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivateMedication(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(PATH);
}

export async function reactivateMedicationAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await reactivateMedication(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(PATH);
}
