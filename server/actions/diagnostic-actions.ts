"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  cancelDiagnostic,
  confirmDiagnosticPayment,
  createDiagnosticCatalogueItem,
  enterDiagnosticResult,
  requestDiagnostic,
  setDiagnosticCatalogueItemActive,
  startDiagnostic,
  validateDiagnosticResult,
} from "@/server/services";

/** Phase 2I — manual lab & radiology actions (request / pay / start / enter / validate / cancel / catalogue). */

export type DiagnosticFormState = { error?: string; ok?: boolean };

const NOT_ALLOWED = "Vous n'êtes pas autorisé à effectuer cette action.";

function toState(error: unknown): DiagnosticFormState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

export async function requestDiagnosticAction(
  encounterId: string,
  _prev: DiagnosticFormState,
  formData: FormData,
): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const catalogueItemId = ((formData.get("catalogueItemId") as string) ?? "").trim();
  if (!catalogueItemId) return { error: "Sélectionnez un examen." };
  try {
    await requestDiagnostic(actor, hospital, { encounterId, catalogueItemId });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

/** Path-aware mutations (revalidate the page they were triggered from — encounter or worklist). */
export async function confirmDiagnosticPaymentAction(path: string, id: string): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await confirmDiagnosticPayment(actor, hospital, id);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(path);
  return { ok: true };
}

export async function startDiagnosticAction(path: string, id: string): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await startDiagnostic(actor, hospital, id);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(path);
  return { ok: true };
}

export async function enterDiagnosticResultAction(
  path: string,
  id: string,
  _prev: DiagnosticFormState,
  formData: FormData,
): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const resultText = ((formData.get("resultText") as string) ?? "").trim();
  if (!resultText) return { error: "Le résultat ne peut pas être vide." };
  try {
    await enterDiagnosticResult(actor, hospital, id, resultText);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(path);
  return { ok: true };
}

export async function validateDiagnosticResultAction(path: string, id: string): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await validateDiagnosticResult(actor, hospital, id);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(path);
  return { ok: true };
}

export async function cancelDiagnosticAction(
  encounterId: string,
  id: string,
  _prev: DiagnosticFormState,
  formData: FormData,
): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const reason = ((formData.get("reason") as string) ?? "").trim();
  if (!reason) return { error: "Le motif d'annulation est obligatoire." };
  try {
    await cancelDiagnostic(actor, hospital, id, reason);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/encounters/${encounterId}`);
  return { ok: true };
}

export async function createDiagnosticCatalogueItemAction(
  _prev: DiagnosticFormState,
  formData: FormData,
): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  const code = ((formData.get("code") as string) ?? "").trim();
  const nameFr = ((formData.get("nameFr") as string) ?? "").trim();
  const nameEn = ((formData.get("nameEn") as string) ?? "").trim() || null;
  const modality = ((formData.get("modality") as string) ?? "").trim();
  const price = Number((formData.get("price") as string) ?? "");
  try {
    await createDiagnosticCatalogueItem(actor, hospital, { code, nameFr, nameEn, modality, price });
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/administration/examens");
  return { ok: true };
}

export async function setDiagnosticCatalogueActiveAction(id: string, isActive: boolean): Promise<DiagnosticFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setDiagnosticCatalogueItemActive(actor, hospital, id, isActive);
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/administration/examens");
  return { ok: true };
}
