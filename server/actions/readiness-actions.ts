"use server";

import { revalidatePath } from "next/cache";

import type { ReadinessStatus } from "@/lib/site-readiness";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { setReadinessItem } from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * Phase 3C — site-readiness actions. Thin transport over the site-readiness service (server-side
 * RBAC + hospital scoping + audit + the supplier-dependent READY gate). Targets the ACTIVE hospital.
 */

const PATH = "/administration/preparation-site";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier la préparation de cet hôpital.";

export async function setReadinessItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const category = (formData.get("category") as string) ?? "";
  const status = (formData.get("status") as string) ?? "";
  try {
    await setReadinessItem(actor, hospital, category, {
      status: status as ReadinessStatus,
      owner: (formData.get("owner") as string) || null,
      evidenceNote: (formData.get("evidenceNote") as string) || null,
      verifier: (formData.get("verifier") as string) || null,
    });
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: NOT_ALLOWED };
    if (e instanceof Error) return { error: e.message };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true };
}
