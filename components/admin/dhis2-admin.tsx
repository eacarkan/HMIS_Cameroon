"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMappingSetAction,
  type Dhis2FormState,
  runMockApiExportAction,
  upsertMappingAction,
} from "@/server/actions/dhis2-actions";

/**
 * Phase 4B — DHIS2 mapping admin forms (client). Thin wrappers over the server actions → DHIS2 service
 * (RBAC + hospital scoping + audit). Aggregate-only; the mock API export makes NO live call.
 */

const initial: Dhis2FormState = {};

function Feedback({ state }: { state: Dhis2FormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function CreateMappingSetForm() {
  const t = useTranslations("dhis2");
  const [state, action, pending] = useActionState(createMappingSetAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">
        {t("code")}
        <Input name="code" className="h-9 w-40" placeholder="DHIS2_DEFAUT" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("name")}
        <Input name="name" className="h-9 w-48" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("orgUnit")}
        <Input name="orgUnitPlaceholder" className="h-9 w-40" placeholder="ORGUNIT_UID" />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {t("createSet")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function AddMappingForm({ mappingSetId }: { mappingSetId: string }) {
  const t = useTranslations("dhis2");
  const [state, action, pending] = useActionState(upsertMappingAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="mappingSetId" value={mappingSetId} />
      <label className="grid gap-1 text-xs">
        {t("localElement")}
        <Input name="localElement" className="h-9 w-40" placeholder="CONSULTATIONS" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("dataElement")}
        <Input name="dataElementPlaceholder" className="h-9 w-40" placeholder="DE_UID" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("categoryOptionCombo")}
        <Input name="categoryOptionComboPlaceholder" className="h-9 w-40" placeholder="COC_UID" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("addMapping")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function ExportForm({ mappingSetId, month }: { mappingSetId: string; month: string }) {
  const t = useTranslations("dhis2");
  const [state, action, pending] = useActionState(runMockApiExportAction, initial);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <a
        className="text-primary text-sm underline"
        href={`/administration/dhis2/export?mappingSetId=${mappingSetId}&month=${month}`}
      >
        {t("exportCsv")}
      </a>
      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="mappingSetId" value={mappingSetId} />
        <input type="hidden" name="month" value={month} />
        <Button type="submit" size="sm" disabled={pending}>
          {t("runMockApi")}
        </Button>
        <Feedback state={state} />
      </form>
    </div>
  );
}
