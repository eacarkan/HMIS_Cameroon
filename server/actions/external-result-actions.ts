"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { importExternalResults, reviewExternalResult } from "@/server/services";

const PATH = "/laboratoire/import";

export type ExternalResultFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): ExternalResultFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function importResultsAction(
  _prev: ExternalResultFormState,
  formData: FormData,
): Promise<ExternalResultFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const res = await importExternalResults(actor, hospital, {
      source: String(formData.get("source") ?? "CSV"),
      csv: String(formData.get("csv") ?? ""),
    });
    revalidatePath(PATH);
    return {
      ok: true,
      message: `Importés : ${res.imported} · doublons : ${res.duplicates} · avertissements : ${res.warnings}${res.errors.length ? ` · erreurs : ${res.errors.length}` : ""}`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewResultAction(
  _prev: ExternalResultFormState,
  formData: FormData,
): Promise<ExternalResultFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await reviewExternalResult(actor, hospital, String(formData.get("id") ?? ""), {
      decision: String(formData.get("decision") ?? "reject") as "promote" | "reject",
      reason: String(formData.get("reason") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Décision enregistrée." };
}
