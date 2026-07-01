"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REPORT_KINDS } from "@/lib/analytics";
import {
  type AnalyticsFormState,
  createDefinitionAction,
  exportRunAction,
  runReportAction,
  toggleDefinitionAction,
} from "@/server/actions/analytics-actions";

/**
 * Phase 4F — analytics admin forms (client). Thin wrappers over the server actions → analytics service
 * (RBAC + hospital scoping + audit). AGGREGATE-ONLY — reports are built from the aggregate operational
 * report; no patient data is selected here.
 */

const initial: AnalyticsFormState = {};

function Feedback({ state }: { state: AnalyticsFormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function CreateDefinitionForm() {
  const t = useTranslations("analytics");
  const [state, action, pending] = useActionState(createDefinitionAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">{t("code")}<Input name="code" className="h-9 w-36" placeholder="MENSUEL" required /></label>
      <label className="grid gap-1 text-xs">{t("name")}<Input name="name" className="h-9 w-48" required /></label>
      <label className="grid gap-1 text-xs">
        {t("kind")}
        <select name="kind" className="border-input bg-background h-9 rounded-md border px-2 text-sm" required>
          {REPORT_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">{t("topN")}<Input name="topN" type="number" min="1" max="50" className="h-9 w-20" defaultValue="10" /></label>
      <label className="grid gap-1 text-xs">{t("schedule")}<Input name="schedulePlaceholder" className="h-9 w-32" placeholder="0 6 1 * *" /></label>
      <Button type="submit" size="sm" disabled={pending}>{t("createDefinition")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function RunForm({ definitionId }: { definitionId: string }) {
  const t = useTranslations("analytics");
  const [state, action, pending] = useActionState(runReportAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="definitionId" value={definitionId} />
      <label className="grid gap-1 text-xs">{t("period")}<Input name="period" type="month" className="h-8 w-36" /></label>
      <label className="grid gap-1 text-xs">
        {t("trigger")}
        <select name="trigger" className="border-input bg-background h-8 rounded-md border px-2 text-sm">
          <option value="ON_DEMAND">{t("onDemand")}</option>
          <option value="SCHEDULED_PLACEHOLDER">{t("scheduledPlaceholder")}</option>
        </select>
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{t("run")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ToggleDefinitionForm({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations("analytics");
  const [state, action, pending] = useActionState(toggleDefinitionAction, initial);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>{isActive ? t("deactivate") : t("activate")}</Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}

export function ExportRunActions({ runId }: { runId: string }) {
  const t = useTranslations("analytics");
  const [state, action, pending] = useActionState(exportRunAction, initial);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="runId" value={runId} />
      <Button type="submit" name="format" value="CSV" size="sm" variant="outline" disabled={pending}>{t("exportCsv")}</Button>
      <Button type="submit" name="format" value="JSON" size="sm" variant="outline" disabled={pending}>{t("exportJson")}</Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : state.ok ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
