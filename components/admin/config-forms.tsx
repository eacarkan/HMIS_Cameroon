"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDepartmentAction,
  deactivateDepartmentAction,
  createServiceUnitAction,
  deactivateServiceUnitAction,
  updateSettingAction,
  createDocumentTemplateAction,
  deactivateDocumentTemplateAction,
  type ActionState,
} from "@/server/actions/config-actions";

/**
 * Configuration create/deactivate forms (Gate 4, client). Thin wrappers over the
 * server actions → Gate 3 config-service (server-side RBAC + scoping + audit). Rendered
 * only when the actor may manage configuration; the server remains the real control.
 */
const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function CreateDepartmentForm() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createDepartmentAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="dep-code">{t("code")}</Label>
        <Input id="dep-code" name="code" className="w-32" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dep-name">{t("name")}</Label>
        <Input id="dep-name" name="name" className="w-56" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function CreateServiceUnitForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createServiceUnitAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="su-code">{t("code")}</Label>
        <Input id="su-code" name="code" className="w-32" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="su-name">{t("name")}</Label>
        <Input id="su-name" name="name" className="w-48" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="su-dept">{t("departmentOptional")}</Label>
        <select
          id="su-dept"
          name="departmentId"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">{t("departmentNone")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function UpdateSettingForm() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(updateSettingAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="set-key">{t("key")}</Label>
        <Input id="set-key" name="key" className="w-56" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="set-value">{t("value")}</Label>
        <Input id="set-value" name="value" className="w-56" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("update")}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function CreateTemplateForm() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createDocumentTemplateAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="tpl-type">{t("type")}</Label>
        <Input id="tpl-type" name="type" className="w-32" defaultValue="receipt" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tpl-name">{t("name")}</Label>
        <Input id="tpl-name" name="name" className="w-48" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tpl-header">{t("header")}</Label>
        <Input id="tpl-header" name="header" className="w-64" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
      <FormError state={state} />
    </form>
  );
}

/** A small inline "Désactiver" form bound to a deactivate server action. */
export function DeactivateButton({
  kind,
  id,
}: {
  kind: "department" | "serviceUnit" | "template";
  id: string;
}) {
  const t = useTranslations("admin");
  const action =
    kind === "department"
      ? deactivateDepartmentAction.bind(null, id)
      : kind === "serviceUnit"
        ? deactivateServiceUnitAction.bind(null, id)
        : deactivateDocumentTemplateAction.bind(null, id);
  return (
    <form action={action}>
      <Button type="submit" variant="ghost" size="sm">
        {t("deactivate")}
      </Button>
    </form>
  );
}
