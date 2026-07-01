"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addToQueueAction, type QueueFormState } from "@/server/actions/queue-actions";

const initial: QueueFormState = {};

/** Phase 2F — reception/triage adds a registered patient (by patient number) to the service queue. */
export function AddToQueueForm({ serviceUnitId, canUrgent }: { serviceUnitId: string; canUrgent: boolean }) {
  const t = useTranslations("queue");
  const [state, action, pending] = useActionState(
    addToQueueAction.bind(null, serviceUnitId),
    initial,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="q-patient">{t("patientNumber")}</Label>
        <Input id="q-patient" name="patientNumber" placeholder="HRB-DEMO-P-2026-000001" className="w-72" required />
      </div>
      {canUrgent ? (
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="isUrgent" className="size-4" />
          {t("urgentLabel")}
        </label>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
      {state.ok ? <p className="text-muted-foreground w-full text-sm">{t("added")}</p> : null}
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
