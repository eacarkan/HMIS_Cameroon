"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTemporaryPatientAction,
  type PatientFormState,
} from "@/server/actions/patient-actions";

const initial: PatientFormState = {};

/**
 * Temporary / unidentified-patient form (Phase 2B). Explicit workflow — names are NOT
 * free-typed; the service generates `Inconnu_YYMMDD_NN`. Apparent sex is required; estimated
 * age + phones are optional.
 */
export function TemporaryPatientForm() {
  const t = useTranslations("patient");
  const tSex = useTranslations("sex");
  const tActions = useTranslations("actions");
  const [state, action, pending] = useActionState(createTemporaryPatientAction, initial);
  const err = state.errors ?? {};
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-foreground">{t("sexApparent")}</Label>
          <select
            name="sex"
            defaultValue=""
            required
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
          >
            <option value="" disabled>
              {t("sexPlaceholder")}
            </option>
            <option value="female">{tSex("female")}</option>
            <option value="male">{tSex("male")}</option>
          </select>
          {err.sex ? <p className="text-destructive text-xs">{err.sex}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground">{t("estimatedAge")}</Label>
          <Input name="estimatedAge" type="number" min={0} max={130} autoComplete="off" />
          {err.estimatedAge ? <p className="text-destructive text-xs">{err.estimatedAge}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground">{t("phone")}</Label>
          <Input name="phone" type="tel" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-foreground">{t("guardianPhone")}</Label>
          <Input name="guardianPhone" type="tel" autoComplete="off" />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t("temporaryHint")}</p>
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
