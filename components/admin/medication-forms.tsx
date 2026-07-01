"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDICATION_FORMS } from "@/lib/medication";
import {
  createMedicationAction,
  deactivateMedicationAction,
  reactivateMedicationAction,
} from "@/server/actions/medication-actions";
import type { ActionState } from "@/server/actions/config-actions";

/** Phase 2D-1 — medication catalogue admin forms (client) → medication-service (admin-only, audited). */
const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function CreateMedicationForm() {
  const t = useTranslations("medication");
  const [state, action, pending] = useActionState(createMedicationAction, initial);
  return (
    <form action={action} className="mt-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="md-code">{t("code")}</Label>
          <Input id="md-code" name="code" className="w-32" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="md-fr">{t("nameFr")}</Label>
          <Input id="md-fr" name="nameFr" className="w-48" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="md-en">{t("nameEn")}</Label>
          <Input id="md-en" name="nameEn" className="w-48" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="md-form">{t("form")}</Label>
          <select
            id="md-form"
            name="form"
            defaultValue={MEDICATION_FORMS[0]}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {MEDICATION_FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="md-unit">{t("unit")}</Label>
          <Input id="md-unit" name="unit" className="w-32" required placeholder={t("unitPlaceholder")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="md-strength">{t("strength")}</Label>
          <Input id="md-strength" name="strength" className="w-28" placeholder="500 mg" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("add")}
        </Button>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function DeactivateMedicationButton({ id }: { id: string }) {
  const t = useTranslations("medication");
  return (
    <form action={deactivateMedicationAction.bind(null, id)}>
      <Button type="submit" variant="ghost" size="sm">
        {t("deactivate")}
      </Button>
    </form>
  );
}

export function ReactivateMedicationButton({ id }: { id: string }) {
  const t = useTranslations("medication");
  return (
    <form action={reactivateMedicationAction.bind(null, id)}>
      <Button type="submit" variant="ghost" size="sm">
        {t("reactivate")}
      </Button>
    </form>
  );
}
