"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPatientAction,
  type PatientFormState,
} from "@/server/actions/patient-actions";

const initialState: PatientFormState = {};

/**
 * Patient registration form (06 §7, §9). Sectioned (Informations principales /
 * complémentaires), keyboard-friendly, visible labels, inline French validation.
 * Submits to `createPatientAction`.
 */
export function PatientForm() {
  const t = useTranslations("patient");
  const tSex = useTranslations("sex");
  const tActions = useTranslations("actions");
  const [state, formAction, pending] = useActionState(
    createPatientAction,
    initialState,
  );
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          {t("sectionPrincipal")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("familyName")} error={err.familyName}>
            <Input name="familyName" autoComplete="off" required />
          </Field>
          <Field label={t("givenName")} error={err.givenName}>
            <Input name="givenName" autoComplete="off" required />
          </Field>
          <Field label={t("sexLabel")} error={err.sex}>
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
          </Field>
          <Field label={t("dateOfBirth")} error={err.dateOfBirth}>
            <Input name="dateOfBirth" type="date" required />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          {t("sectionComplementaire")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("phone")} error={err.phone}>
            <Input name="phone" type="tel" autoComplete="off" />
          </Field>
          <Field label={t("residence")} error={err.residence}>
            <Input name="residence" autoComplete="off" />
          </Field>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="reset" variant="outline" disabled={pending}>
          {tActions("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {tActions("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground">{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
