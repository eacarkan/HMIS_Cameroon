"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import type { ClaimStatusCode, EligibilityStatusCode } from "@/lib/insurance";
import {
  createClaimDraftForActor,
  createCoverageProfileForActor,
  createPayerForActor,
  decidePreAuthForActor,
  linkPatientCoverageForActor,
  setEligibilityPlaceholderForActor,
  transitionClaimForActor,
} from "@/server/services";

const PATH = "/facturation/assurance";

export type InsuranceFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): InsuranceFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function createPayerAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createPayerForActor(actor, hospital, { code: String(formData.get("code") ?? ""), name: String(formData.get("name") ?? ""), kind: String(formData.get("kind") ?? "MUTUELLE") });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Payeur créé." };
}

export async function createCoverageProfileAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createCoverageProfileForActor(actor, hospital, {
      payerId: String(formData.get("payerId") ?? ""),
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      coveragePercent: Number(formData.get("coveragePercent") ?? 0),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Profil de couverture créé." };
}

export async function linkCoverageAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await linkPatientCoverageForActor(actor, hospital, {
      patientId: String(formData.get("patientId") ?? ""),
      payerId: String(formData.get("payerId") ?? ""),
      memberNumber: String(formData.get("memberNumber") ?? ""),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Couverture liée." };
}

export async function setEligibilityAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setEligibilityPlaceholderForActor(actor, hospital, String(formData.get("coverageId") ?? ""), String(formData.get("eligibility") ?? "UNKNOWN") as EligibilityStatusCode);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Éligibilité (placeholder) mise à jour." };
}

export async function createClaimAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createClaimDraftForActor(actor, hospital, {
      patientCoverageId: String(formData.get("coverageId") ?? ""),
      invoiceId: String(formData.get("invoiceId") ?? "") || null,
      amountClaimed: Number(formData.get("amountClaimed") ?? 0),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Brouillon de dossier créé." };
}

export async function transitionClaimAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await transitionClaimForActor(actor, hospital, String(formData.get("id") ?? ""), String(formData.get("to") ?? "") as ClaimStatusCode);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Statut du dossier mis à jour." };
}

export async function decidePreAuthAction(_prev: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await decidePreAuthForActor(actor, hospital, String(formData.get("id") ?? ""), {
      decision: String(formData.get("decision") ?? "reject") as "approve" | "reject",
      reason: String(formData.get("reason") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Décision enregistrée." };
}
