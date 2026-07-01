"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import type { ReportExportFormatCode, ReportTriggerCode } from "@/lib/analytics";
import { parseMonthParam } from "@/lib/reporting";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createReportDefinitionForActor,
  exportReportRunForActor,
  runReportForActor,
  setReportDefinitionActiveForActor,
} from "@/server/services";

const PATH = "/administration/analytics";

export type AnalyticsFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): AnalyticsFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

/** Resolve a "YYYY-MM" period field, defaulting to the current month. */
function resolvePeriod(raw: string): { year: number; month: number } {
  const parsed = parseMonthParam(raw);
  if (parsed) return parsed;
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export async function createDefinitionAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const topNRaw = String(formData.get("topN") ?? "");
    await createReportDefinitionForActor(actor, hospital, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      topN: topNRaw ? Number(topNRaw) : null,
      schedulePlaceholder: String(formData.get("schedulePlaceholder") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Définition de rapport créée." };
}

export async function toggleDefinitionAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setReportDefinitionActiveForActor(actor, hospital, String(formData.get("id") ?? ""), String(formData.get("isActive") ?? "true") === "true");
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Définition mise à jour." };
}

export async function runReportAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const { year, month } = resolvePeriod(String(formData.get("period") ?? ""));
    const run = await runReportForActor(actor, hospital, {
      definitionId: String(formData.get("definitionId") ?? ""),
      year,
      month,
      trigger: String(formData.get("trigger") ?? "ON_DEMAND") as ReportTriggerCode,
    });
    return { ok: true, message: `Rapport exécuté — ${run?.rowCount ?? 0} lignes agrégées (${run?.periodLabel ?? ""}).` };
  } catch (error) {
    return fail(error);
  } finally {
    revalidatePath(PATH);
  }
}

export async function exportRunAction(_prev: AnalyticsFormState, formData: FormData): Promise<AnalyticsFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const res = await exportReportRunForActor(actor, hospital, {
      runId: String(formData.get("runId") ?? ""),
      format: String(formData.get("format") ?? "CSV") as ReportExportFormatCode,
    });
    revalidatePath(PATH);
    return { ok: true, message: `Export ${res.format} enregistré — ${res.rowCount} lignes agrégées (${res.filename}).` };
  } catch (error) {
    return fail(error);
  }
}
