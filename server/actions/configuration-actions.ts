"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  applyTemplate,
  recomputeConfigurationCompleteness,
  overrideInstanceSetting,
} from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * Phase 3A — multi-hospital configuration actions. Thin transport over the
 * hospital-configuration-service (server-side RBAC + hospital scoping + audit). Every action
 * targets the ACTIVE hospital only; cross-hospital configuration is impossible here.
 */

const PATH = "/administration/configuration";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier la configuration de cet hôpital.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

/** Apply a configuration template to the active hospital (guarded, scoped, audited). */
export async function applyTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const templateId = (formData.get("templateId") as string) ?? "";
  if (!templateId) return { error: "Veuillez choisir un modèle à appliquer." };
  try {
    await applyTemplate(actor, hospital, templateId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Recompute + audit the active hospital's configuration completeness. */
export async function recomputeCompletenessAction(): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await recomputeConfigurationCompleteness(actor, hospital);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(PATH);
}

/** Override a single instance Setting for the active hospital (per-instance divergence). */
export async function overrideInstanceSettingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const key = (formData.get("key") as string) ?? "";
  const value = (formData.get("value") as string) ?? "";
  try {
    await overrideInstanceSetting(actor, hospital, key, value);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}
