"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { PrescriptionItemInput } from "@/lib/prescription";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  cancelPrescription,
  createPrescription,
  finalizePrescription,
  sendPrescriptionToPharmacy,
} from "@/server/services";

/** Phase 2D-2 — prescription actions (doctor creates + drives the lifecycle). */

export type PrescriptionFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à gérer les ordonnances.";

export async function createPrescriptionAction(
  encounterId: string,
  _prev: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  let items: PrescriptionItemInput[] = [];
  try {
    const raw = (formData.get("itemsJson") as string) || "[]";
    items = JSON.parse(raw);
  } catch {
    return { error: "Ordonnance invalide (lignes illisibles)." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Ajoutez au moins un médicament à l'ordonnance." };
  }
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  let id: string;
  try {
    const presc = await createPrescription(actor, hospital, { encounterId, notes, items });
    id = presc.id;
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  redirect(`/ordonnances/${id}`);
}

type Transition = typeof finalizePrescription;

async function runTransition(id: string, fn: Transition): Promise<PrescriptionFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await fn(actor, hospital, id);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/ordonnances/${id}`);
  return { ok: true };
}

export async function finalizePrescriptionAction(
  id: string,
  _prev: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  void formData;
  return runTransition(id, finalizePrescription);
}

export async function sendPrescriptionAction(
  id: string,
  _prev: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  void formData;
  return runTransition(id, sendPrescriptionToPharmacy);
}

export async function cancelPrescriptionAction(
  id: string,
  _prev: PrescriptionFormState,
  formData: FormData,
): Promise<PrescriptionFormState> {
  void formData;
  return runTransition(id, cancelPrescription);
}
