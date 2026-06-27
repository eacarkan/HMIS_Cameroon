"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordConsultationAction,
  type ConsultationFormState,
} from "@/server/actions/consultation-actions";

const initialState: ConsultationFormState = {};

/** Minimal consultation form (05 §4, 06 §14): motif + free-text fields. */
export function ConsultationForm({
  encounterId,
  defaultReason,
}: {
  encounterId: string;
  defaultReason: string;
}) {
  const t = useTranslations("consultation");
  const tActions = useTranslations("actions");
  const action = recordConsultationAction.bind(null, encounterId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Input
          id="reason"
          name="reason"
          defaultValue={defaultReason}
          required
        />
        {err.reason ? (
          <p className="text-destructive text-xs">{err.reason}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clinicalNote">{t("clinicalNote")}</Label>
        <textarea
          id="clinicalNote"
          name="clinicalNote"
          rows={3}
          placeholder={t("clinicalNotePlaceholder")}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vitals">{t("vitals")}</Label>
          <Input
            id="vitals"
            name="vitals"
            placeholder={t("vitalsPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provisionalDiagnosis">{t("diagnosis")}</Label>
          <Input id="provisionalDiagnosis" name="provisionalDiagnosis" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="recommendation">{t("recommendation")}</Label>
        <textarea
          id="recommendation"
          name="recommendation"
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {tActions("save")}
        </Button>
      </div>
    </form>
  );
}
