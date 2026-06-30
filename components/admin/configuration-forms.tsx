"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyTemplateAction,
  recomputeCompletenessAction,
  overrideInstanceSettingAction,
} from "@/server/actions/configuration-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * Phase 3A — multi-hospital configuration forms (client). Thin wrappers over the server actions
 * → hospital-configuration-service (server-side RBAC + hospital scoping + audit). Rendered only
 * when the actor may manage instance configuration; the server remains the real control.
 */
const initial: ActionState = {};

function FormFeedback({ state }: { state: ActionState }) {
  const t = useTranslations("configAdmin");
  if (state.error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {t("actionDone")}
      </p>
    );
  }
  return null;
}

export function ApplyTemplateForm({
  templates,
}: {
  templates: { id: string; code: string; name: string; version: number }[];
}) {
  const t = useTranslations("configAdmin");
  const [state, action, pending] = useActionState(applyTemplateAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="apply-template">{t("template")}</Label>
        <select
          id="apply-template"
          name="templateId"
          required
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t("chooseTemplate")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name} ({tpl.code} v{tpl.version})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("applyTemplate")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}

export function RecomputeButton() {
  const t = useTranslations("configAdmin");
  return (
    <form action={recomputeCompletenessAction}>
      <Button type="submit" size="sm" variant="secondary">
        {t("recompute")}
      </Button>
    </form>
  );
}

export function OverrideSettingForm() {
  const t = useTranslations("configAdmin");
  const [state, action, pending] = useActionState(overrideInstanceSettingAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="override-key">{t("settingKey")}</Label>
        <Input id="override-key" name="key" className="w-56" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="override-value">{t("settingValue")}</Label>
        <Input id="override-value" name="value" className="w-56" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("saveOverride")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
