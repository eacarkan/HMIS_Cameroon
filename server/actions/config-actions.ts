"use server";

import { revalidatePath } from "next/cache";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createDepartment,
  deactivateDepartment,
  createServiceUnit,
  updateServiceUnit,
  deactivateServiceUnit,
  reactivateServiceUnit,
  reorderServices,
  setServiceEligibility,
  listServiceCatalogue,
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

// ---- Service catalogue (Phase 2A) — capability-gated by the service layer ----

function readServiceFlags(fd: FormData) {
  return {
    acceptsQueue: fd.get("acceptsQueue") === "on",
    acceptsConsultation: fd.get("acceptsConsultation") === "on",
    supportsBilling: fd.get("supportsBilling") === "on",
    supportsPharmacy: fd.get("supportsPharmacy") === "on",
    supportsLab: fd.get("supportsLab") === "on",
    supportsImaging: fd.get("supportsImaging") === "on",
    isInpatientWard: fd.get("isInpatientWard") === "on",
    isEmergency: fd.get("isEmergency") === "on",
  };
}

function readServiceInput(fd: FormData) {
  const order = ((fd.get("displayOrder") as string) ?? "").trim();
  return {
    code: ((fd.get("code") as string) ?? "").trim(),
    nameFr: ((fd.get("nameFr") as string) ?? "").trim(),
    nameEn: (((fd.get("nameEn") as string) ?? "").trim() || null) as string | null,
    type: ((fd.get("type") as string) ?? "SUPPORT").trim(),
    displayOrder: order ? Number(order) : undefined,
    departmentId: (((fd.get("departmentId") as string) || null)) as string | null,
    kind: (((fd.get("kind") as string) ?? "").trim() || null) as string | null,
  };
}

export async function createServiceUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const input = readServiceInput(formData);
  if (!input.code) return { errors: { code: "Le code est obligatoire." } };
  if (!input.nameFr) return { errors: { nameFr: "Le nom (français) est obligatoire." } };
  try {
    await createServiceUnit(actor, hospital, { ...input, ...readServiceFlags(formData) });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function updateServiceUnitAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const input = readServiceInput(formData);
  if (!input.nameFr) return { errors: { nameFr: "Le nom (français) est obligatoire." } };
  try {
    // No flags here — identity edit preserves eligibility (managed via setServiceEligibility).
    await updateServiceUnit(actor, hospital, id, input);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/administration");
  return { ok: true };
}

export async function setServiceEligibilityAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setServiceEligibility(actor, hospital, id, readServiceFlags(formData));
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

export async function reactivateServiceUnitAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await reactivateServiceUnit(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath("/administration");
}

export async function moveServiceAction(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const list = await listServiceCatalogue(actor, hospital);
    const ids = list.map((s) => s.id);
    const i = ids.indexOf(id);
    if (i < 0) return;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderServices(actor, hospital, ids);
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
