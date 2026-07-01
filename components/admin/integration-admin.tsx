"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCredentialReferenceAction,
  configureConnectorAction,
  createExternalSystemAction,
  type IntegrationFormState,
  retryJobAction,
  runJobAction,
} from "@/server/actions/integration-actions";

/**
 * Phase 4A — integration-admin forms (client). Thin wrappers over the server actions → integration
 * service (server-side RBAC + hospital scoping + audit). Everything is clearly marked MOCK / sandbox;
 * the framework makes NO live external call. The server remains authoritative.
 */

export type ConnectorView = {
  id: string;
  name: string;
  environment: "MOCK" | "SANDBOX" | "PRODUCTION_DISABLED";
  isActive: boolean;
  lastError: string | null;
};
export type CredentialRefView = { id: string; name: string; referenceKind: string; referenceValue: string };
export type SystemView = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: "ACTIVE" | "INACTIVE" | "NEEDS_CONFIGURATION";
  connectors: ConnectorView[];
  credentialReferences: CredentialRefView[];
};
export type JobView = {
  id: string;
  kind: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  systemCode: string;
  connectorName: string | null;
};

const initial: IntegrationFormState = {};
const ENVIRONMENTS = ["MOCK", "SANDBOX", "PRODUCTION_DISABLED"] as const;
const REF_KINDS = ["ENV_VAR", "VAULT_PATH", "DESCRIPTION"] as const;

function FormFeedback({ state }: { state: IntegrationFormState }) {
  const t = useTranslations("integration");
  if (state.error) {
    return (
      <p role="alert" className="text-destructive text-xs">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-xs text-emerald-700">
        {state.message ?? t("saved")}
      </p>
    );
  }
  return null;
}

export function CreateSystemForm() {
  const t = useTranslations("integration");
  const [state, action, pending] = useActionState(createExternalSystemAction, initial);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2 sm:items-end">
      <label className="grid gap-1 text-xs">
        {t("code")}
        <Input name="code" className="h-9" placeholder="DHIS2_NATIONAL" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("name")}
        <Input name="name" className="h-9" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("kind")}
        <Input name="kind" className="h-9" placeholder="GENERIC" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("description")}
        <Input name="description" className="h-9" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t("createSystem")}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function ConnectorForm({ systemId }: { systemId: string }) {
  const t = useTranslations("integration");
  const [state, action, pending] = useActionState(configureConnectorAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="externalSystemId" value={systemId} />
      <label className="grid gap-1 text-xs">
        {t("connectorName")}
        <Input name="name" className="h-9 w-40" placeholder="mock-primary" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("environment")}
        <select name="environment" defaultValue="MOCK" className="border-input bg-background h-9 rounded-md border px-2 text-sm">
          {ENVIRONMENTS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("saveConnector")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}

export function CredentialReferenceForm({ systemId }: { systemId: string }) {
  const t = useTranslations("integration");
  const [state, action, pending] = useActionState(addCredentialReferenceAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="externalSystemId" value={systemId} />
      <label className="grid gap-1 text-xs">
        {t("referenceName")}
        <Input name="name" className="h-9 w-36" placeholder="api-token" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("referenceKind")}
        <select name="referenceKind" defaultValue="ENV_VAR" className="border-input bg-background h-9 rounded-md border px-2 text-sm">
          {REF_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs">
        {t("referenceValue")}
        <Input name="referenceValue" className="h-9 w-44" placeholder="DHIS2_API_TOKEN" required />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("addReference")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}

export function RunJobForm({ systemId }: { systemId: string }) {
  const t = useTranslations("integration");
  const [state, action, pending] = useActionState(runJobAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="externalSystemId" value={systemId} />
      <label className="grid gap-1 text-xs">
        {t("jobKind")}
        <Input name="kind" className="h-9 w-36" defaultValue="MOCK_RUN" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("jobRef")}
        <Input name="ref" className="h-9 w-36" placeholder="run-1" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {t("runJob")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}

export function RetryJobButton({ jobId }: { jobId: string }) {
  const t = useTranslations("integration");
  const [state, action, pending] = useActionState(retryJobAction, initial);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("retry")}
      </Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}
