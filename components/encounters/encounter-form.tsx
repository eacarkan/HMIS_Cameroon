"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  openEncounterAction,
  type EncounterFormState,
} from "@/server/actions/encounter-actions";

const initialState: EncounterFormState = {};

const SERVICES = [
  "Médecine générale",
  "Pédiatrie",
  "Gynéco-obstétrique",
  "Médecine interne",
  "Chirurgie",
];

/**
 * Open-a-visit form (06 §14): short form within the patient context. Phase 2A — the service
 * options are a DOWNSTREAM consumer of the active service catalogue (`services` prop); it
 * falls back to the built-in list when none are configured/available.
 */
export function EncounterForm({
  patientId,
  services = [],
}: {
  patientId: string;
  services?: string[];
}) {
  const t = useTranslations("encounter");
  const tActions = useTranslations("actions");
  const action = openEncounterAction.bind(null, patientId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const err = state.errors ?? {};
  const options = services.length > 0 ? services : SERVICES;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="serviceLabel">{t("service")}</Label>
        <select
          id="serviceLabel"
          name="serviceLabel"
          defaultValue={options[0]}
          className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm shadow-xs"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {err.serviceLabel ? (
          <p className="text-destructive text-xs">{err.serviceLabel}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">{t("reason")}</Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder={t("reasonPlaceholder")}
          required
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
        />
        {err.reason ? (
          <p className="text-destructive text-xs">{err.reason}</p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {tActions("openEncounter")}
        </Button>
      </div>
    </form>
  );
}
