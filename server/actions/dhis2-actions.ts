"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  createDhis2MappingSetForActor,
  runDhis2MockApiExport,
  upsertDhis2MappingForActor,
} from "@/server/services";
import { monthLabel, parseMonthParam } from "@/lib/reporting";

const PATH = "/administration/dhis2";

export type Dhis2FormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): Dhis2FormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé à gérer les exports DHIS2." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

function period(formData: FormData) {
  const monthParam = String(formData.get("month") ?? "") || monthLabel(new Date());
  return parseMonthParam(monthParam) ?? parseMonthParam(monthLabel(new Date()))!;
}

export async function createMappingSetAction(
  _prev: Dhis2FormState,
  formData: FormData,
): Promise<Dhis2FormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createDhis2MappingSetForActor(actor, hospital, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      orgUnitPlaceholder: String(formData.get("orgUnitPlaceholder") ?? ""),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Jeu de correspondances créé." };
}

export async function upsertMappingAction(
  _prev: Dhis2FormState,
  formData: FormData,
): Promise<Dhis2FormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await upsertDhis2MappingForActor(actor, hospital, {
      mappingSetId: String(formData.get("mappingSetId") ?? ""),
      localElement: String(formData.get("localElement") ?? ""),
      dataElementPlaceholder: String(formData.get("dataElementPlaceholder") ?? ""),
      categoryOptionComboPlaceholder: String(formData.get("categoryOptionComboPlaceholder") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Correspondance enregistrée." };
}

export async function runMockApiExportAction(
  _prev: Dhis2FormState,
  formData: FormData,
): Promise<Dhis2FormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    const result = await runDhis2MockApiExport(actor, hospital, {
      mappingSetId: String(formData.get("mappingSetId") ?? ""),
      ...period(formData),
    });
    revalidatePath(PATH);
    return { ok: true, message: `Export API fictif : ${result.rowCount} ligne(s) agrégée(s) (aucun appel réseau).` };
  } catch (error) {
    return fail(error);
  }
}
