"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { READINESS_STATUSES } from "@/lib/site-readiness";
import { UAT_STATUSES } from "@/lib/uat-gate7";
import {
  recordUatExecutionAction,
  setGate7ItemAction,
  setGate7SignoffAction,
} from "@/server/actions/uat-actions";
import type { ActionState } from "@/server/actions/config-actions";

/** Phase 3E — UAT + Gate 7 forms (client). Thin wrappers over the server actions (RBAC + audit). */
const initial: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  const t = useTranslations("uat");
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{t("saved")}</p>;
  return null;
}

export function RecordUatForm({ code, status, notes }: { code: string; status: string; notes: string | null }) {
  const t = useTranslations("uat");
  const [state, action, pending] = useActionState(recordUatExecutionAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="code" value={code} />
      <select name="status" defaultValue={status} className="border-input bg-background h-9 rounded-md border px-2 text-sm">
        {UAT_STATUSES.map((s) => (
          <option key={s} value={s}>{t(`statuses.${s}`)}</option>
        ))}
      </select>
      <Input name="notes" className="h-9 w-56" placeholder={t("notes")} defaultValue={notes ?? ""} />
      <Button type="submit" size="sm" disabled={pending}>{t("save")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function Gate7ItemForm({ criterion, status, note }: { criterion: string; status: string; note: string | null }) {
  const t = useTranslations("uat");
  const [state, action, pending] = useActionState(setGate7ItemAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="criterion" value={criterion} />
      <select name="status" defaultValue={status} className="border-input bg-background h-9 rounded-md border px-2 text-sm">
        {READINESS_STATUSES.map((s) => (
          <option key={s} value={s}>{t(`gate7Statuses.${s}`)}</option>
        ))}
      </select>
      <Input name="note" className="h-9 w-56" placeholder={t("note")} defaultValue={note ?? ""} />
      <Button type="submit" size="sm" disabled={pending}>{t("save")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function Gate7SignoffForm({
  criterion,
  director,
  minsante,
}: {
  criterion: string;
  director: string | null;
  minsante: string | null;
}) {
  const t = useTranslations("uat");
  const [state, action, pending] = useActionState(setGate7SignoffAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="criterion" value={criterion} />
      <Input name="director" className="h-9 w-44" placeholder={t("directorSignoff")} defaultValue={director ?? ""} />
      <Input name="minsante" className="h-9 w-44" placeholder={t("minsanteSignoff")} defaultValue={minsante ?? ""} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{t("signoff")}</Button>
      <Feedback state={state} />
    </form>
  );
}
