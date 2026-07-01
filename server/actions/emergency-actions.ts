"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  accrueEmergencyDebt,
  flagEncounterEmergency,
  settleEmergencyDebt,
  waiveEmergencyDebt,
} from "@/server/services";

/** Phase 2H — emergency exception actions (flag; accrue/settle/waive emergency debt). */

export type EmergencyFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function flagEmergencyAction(
  encounterId: string,
  isEmergency: boolean,
): Promise<EmergencyFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await flagEncounterEmergency(actor, hospital, encounterId, isEmergency);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function accrueEmergencyDebtAction(
  encounterId: string,
  _prev: EmergencyFormState,
  formData: FormData,
): Promise<EmergencyFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const amount = Number((formData.get("amount") as string) ?? "");
  const source = ((formData.get("source") as string) ?? "").trim();
  try {
    await accrueEmergencyDebt(actor, hospital, { encounterId, amount, source });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function settleEmergencyDebtAction(
  encounterId: string,
  id: string,
): Promise<EmergencyFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await settleEmergencyDebt(actor, hospital, id);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function waiveEmergencyDebtAction(
  encounterId: string,
  id: string,
  _prev: EmergencyFormState,
  formData: FormData,
): Promise<EmergencyFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation (Directeur) est obligatoire." };
  try {
    await waiveEmergencyDebt(actor, hospital, id, reason);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}
