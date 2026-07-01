"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { addToQueue, advanceQueueTicket, setQueueUrgent } from "@/server/services";
import type { QueueStatusValue } from "@/lib/queue";

/** Phase 2F — digital queue actions (add a patient; advance status; toggle urgent). */

export type QueueFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

export async function addToQueueAction(
  serviceUnitId: string,
  _prev: QueueFormState,
  formData: FormData,
): Promise<QueueFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const patientNumber = ((formData.get("patientNumber") as string) ?? "").trim();
  const isUrgent = formData.get("isUrgent") === "on";
  if (!patientNumber) return { error: "Le numéro patient est obligatoire." };
  try {
    await addToQueue(actor, hospital, { serviceUnitId, patientNumber, isUrgent });
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/file-attente");
  return { ok: true };
}

export async function advanceQueueAction(
  id: string,
  toStatus: QueueStatusValue,
): Promise<QueueFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await advanceQueueTicket(actor, hospital, id, toStatus);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/file-attente");
  return { ok: true };
}

export async function toggleQueueUrgentAction(id: string, isUrgent: boolean): Promise<QueueFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setQueueUrgent(actor, hospital, id, isUrgent);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: userFacingMessage(error) };
    throw error;
  }
  revalidatePath("/file-attente");
  return { ok: true };
}
