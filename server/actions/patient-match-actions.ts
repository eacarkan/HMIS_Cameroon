"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import type { PatientMatchStatusCode } from "@/lib/patient-match";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  generateMatchCandidatesForActor,
  recordMatchDecisionForActor,
  runMockMpiCheckForActor,
  startMatchReviewForActor,
} from "@/server/services";

const PATH = "/patients/match-review";

export type MatchFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): MatchFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function generateCandidatesAction(): Promise<MatchFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const res = await generateMatchCandidatesForActor(actor, hospital);
    revalidatePath(PATH);
    return { ok: true, message: `${res.created} candidat(s) créé(s) sur ${res.scanned} patient(s) analysé(s) (avertissement uniquement — aucune fusion).` };
  } catch (error) {
    return fail(error);
  }
}

export async function startReviewAction(_prev: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await startMatchReviewForActor(actor, hospital, String(formData.get("id") ?? ""));
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Revue démarrée." };
}

export async function recordDecisionAction(_prev: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await recordMatchDecisionForActor(actor, hospital, String(formData.get("id") ?? ""), {
      decision: String(formData.get("decision") ?? "") as PatientMatchStatusCode,
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Décision enregistrée (jugement uniquement — aucun dossier patient modifié)." };
}

export async function mockMpiCheckAction(_prev: MatchFormState, formData: FormData): Promise<MatchFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const res = await runMockMpiCheckForActor(actor, hospital, String(formData.get("id") ?? ""));
    revalidatePath(PATH);
    return { ok: true, message: `MPI fictif (${res.source}) — ${res.matched ? "correspondance" : "aucune correspondance"} · aucun appel réseau.` };
  } catch (error) {
    return fail(error);
  }
}
