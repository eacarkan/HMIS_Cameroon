"use server";

import { revalidatePath } from "next/cache";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createDepartment,
  deactivateDepartment,
  createServiceUnit,
  deactivateServiceUnit,
  updateSetting,
  createDocumentTemplate,
  deactivateDocumentTemplate,
} from "@/server/services";

/**
 * Configuration transport actions (Gate 4). Thin: validate at the edge, delegate to the
 * Gate 3 `config-service` (which authorizes server-side, scopes by hospital and audits),
 * then revalidate the admin page. No business logic, no Prisma here.
 */
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
};

const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier la configuration.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

const codeName = z.object({
  code: z.string().trim().min(1, { message: "Le code est obligatoire." }),
  name: z.string().trim().min(1, { message: "Le nom est obligatoire." }),
});

export async function createDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const parsed = codeName.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { errors: flatten(parsed.error) };
  try {
    await createDepartment(actor, hospital, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function deactivateDepartmentAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivateDepartment(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath("/administration");
}

export async function createServiceUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const parsed = codeName.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { errors: flatten(parsed.error) };
  const kind = (formData.get("kind") as string)?.trim() || null;
  const departmentId = (formData.get("departmentId") as string) || null;
  try {
    await createServiceUnit(actor, hospital, { ...parsed.data, kind, departmentId });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function deactivateServiceUnitAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivateServiceUnit(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath("/administration");
}

export async function updateSettingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const key = (formData.get("key") as string)?.trim();
  const value = (formData.get("value") as string) ?? "";
  if (!key) return { errors: { key: "La clé est obligatoire." } };
  try {
    await updateSetting(actor, hospital, key, value);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function createDocumentTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const type = (formData.get("type") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!type || !name)
    return { errors: { name: "Le type et le nom sont obligatoires." } };
  const header = (formData.get("header") as string)?.trim() || null;
  try {
    await createDocumentTemplate(actor, hospital, { type, name, header });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function deactivateDocumentTemplateAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivateDocumentTemplate(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath("/administration");
}

function flatten(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(error.flatten().fieldErrors)) {
    const msgs = v as string[] | undefined;
    if (msgs?.[0]) out[k] = msgs[0];
  }
  return out;
}
