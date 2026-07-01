"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import type { SiteReadinessStatus } from "@prisma/client";
import type { UatStatus } from "@/lib/uat-gate7";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import { recordUatExecution, setGate7Item, setGate7Signoff } from "@/server/services";
import type { ActionState } from "./config-actions";

/** Phase 3E — UAT + Gate 7 readiness actions (evidence only). Server-side RBAC + scoping + audit. */

const PATH = "/uat";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: "Action non autorisée pour cet hôpital." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function recordUatExecutionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await recordUatExecution(actor, hospital, (formData.get("code") as string) ?? "", {
      status: (formData.get("status") as string) as UatStatus,
      notes: (formData.get("notes") as string) || null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function setGate7ItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setGate7Item(actor, hospital, (formData.get("criterion") as string) ?? "", {
      status: (formData.get("status") as string) as SiteReadinessStatus,
      note: (formData.get("note") as string) || null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function setGate7SignoffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setGate7Signoff(actor, hospital, (formData.get("criterion") as string) ?? "", {
      directorSignoffPlaceholder: (formData.get("director") as string) || null,
      minsanteSignoffPlaceholder: (formData.get("minsante") as string) || null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(PATH);
  return { ok: true };
}
