"use server";

import { revalidatePath } from "next/cache";

import { z } from "@/lib/validation";
import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createPriceList,
  deactivatePriceList,
  createTariff,
  deactivateTariff,
} from "@/server/services";
import type { ActionState } from "./config-actions";

/**
 * Tariff / price-list transport actions (Gate 4). Delegate to the Gate 3 `tariff-service`
 * (admin-only mutation, integer FCFA, hospital-scoped, audited). Integer FCFA enforced at
 * the edge and again in the service. No partial-payment / accounting logic here.
 */
const TARIFFS_PATH = "/administration/tarifs";
const NOT_ALLOWED = "Vous n'êtes pas autorisé à modifier les tarifs.";

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { error: NOT_ALLOWED };
  if (error instanceof Error) return { error: error.message };
  throw error;
}

const codeName = z.object({
  code: z.string().trim().min(1, { message: "Le code est obligatoire." }),
  name: z.string().trim().min(1, { message: "Le nom est obligatoire." }),
});

export async function createPriceListAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const parsed = codeName.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { errors: { code: fe.code?.[0] ?? "", name: fe.name?.[0] ?? "" } };
  }
  try {
    await createPriceList(actor, hospital, parsed.data);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(TARIFFS_PATH);
  return { ok: true };
}

export async function deactivatePriceListAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivatePriceList(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(TARIFFS_PATH);
}

export async function createTariffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { actor, hospital } = await requireActorAndHospital();
  const code = (formData.get("code") as string)?.trim();
  const label = (formData.get("label") as string)?.trim();
  const amount = Number(formData.get("amount"));
  const priceListId = (formData.get("priceListId") as string) || null;
  if (!code || !label) {
    return { errors: { code: "Le code et le libellé sont obligatoires." } };
  }
  if (!Number.isInteger(amount) || amount < 0) {
    return { errors: { amount: "Montant FCFA invalide — entier positif requis." } };
  }
  try {
    await createTariff(actor, hospital, { code, label, amount, priceListId });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(TARIFFS_PATH);
  return { ok: true };
}

export async function deactivateTariffAction(id: string): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await deactivateTariff(actor, hospital, id);
  } catch (e) {
    if (!(e instanceof AuthorizationError)) throw e;
  }
  revalidatePath(TARIFFS_PATH);
}
