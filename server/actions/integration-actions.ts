"use server";

import { revalidatePath } from "next/cache";
import { userFacingMessage } from "@/lib/errors";

import { AuthorizationError } from "@/server/authz";
import { requireActorAndHospital } from "@/server/auth";
import {
  addCredentialReferenceForActor,
  configureConnectorForActor,
  createExternalSystemForActor,
  retryIntegrationJobForActor,
  runIntegrationJobForActor,
  setExternalSystemConfigForActor,
  setExternalSystemStatusForActor,
} from "@/server/services";

const PATH = "/administration/integration";

export type IntegrationFormState = { error?: string; ok?: boolean; message?: string };

function fail(error: unknown): IntegrationFormState {
  if (error instanceof AuthorizationError) return { error: "Vous n'êtes pas autorisé à gérer les intégrations." };
  if (error instanceof Error) return { error: userFacingMessage(error) };
  throw error;
}

export async function createExternalSystemAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await createExternalSystemForActor(actor, hospital, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Système externe créé (fictif)." };
}

export async function configureConnectorAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await configureConnectorForActor(actor, hospital, {
      externalSystemId: String(formData.get("externalSystemId") ?? ""),
      name: String(formData.get("name") ?? ""),
      environment: String(formData.get("environment") ?? "MOCK"),
      isActive: formData.get("isActive") === null ? undefined : formData.get("isActive") === "true",
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Connecteur configuré (fictif)." };
}

export async function setExternalSystemConfigAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setExternalSystemConfigForActor(actor, hospital, {
      externalSystemId: String(formData.get("externalSystemId") ?? ""),
      key: String(formData.get("key") ?? ""),
      value: String(formData.get("value") ?? ""),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Configuration enregistrée." };
}

export async function addCredentialReferenceAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await addCredentialReferenceForActor(actor, hospital, {
      externalSystemId: String(formData.get("externalSystemId") ?? ""),
      name: String(formData.get("name") ?? ""),
      referenceKind: String(formData.get("referenceKind") ?? "ENV_VAR"),
      referenceValue: String(formData.get("referenceValue") ?? ""),
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Référence d'identifiant enregistrée (aucun secret stocké)." };
}

export async function setExternalSystemStatusAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await setExternalSystemStatusForActor(
      actor,
      hospital,
      String(formData.get("externalSystemId") ?? ""),
      String(formData.get("status") ?? "NEEDS_CONFIGURATION") as
        | "ACTIVE"
        | "INACTIVE"
        | "NEEDS_CONFIGURATION",
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Statut mis à jour." };
}

export async function runJobAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await runIntegrationJobForActor(actor, hospital, {
      externalSystemId: String(formData.get("externalSystemId") ?? ""),
      connectorId: String(formData.get("connectorId") ?? "") || null,
      kind: String(formData.get("kind") ?? "MOCK_RUN"),
      ref: String(formData.get("ref") ?? "") || `manual-${formData.get("kind") ?? "MOCK_RUN"}`,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Tâche d'intégration exécutée (fictive)." };
}

export async function retryJobAction(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { actor, hospital } = await requireActorAndHospital();
  try {
    await retryIntegrationJobForActor(actor, hospital, String(formData.get("jobId") ?? ""));
  } catch (error) {
    return fail(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Tâche relancée." };
}
