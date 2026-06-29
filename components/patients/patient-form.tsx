"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { DuplicateWarning } from "@/components/patients/duplicate-warning";
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
  const duplicates = state.duplicates ?? [];
  const hasDuplicateWarning = duplicates.length > 0;
  // Echoed values repopulate the form after a duplicate warning (React 19 resets the
  // form once an action returns, so uncontrolled inputs would otherwise be cleared).
  const v = state.values;

  return (
    // Remount when the warning toggles so defaultValue/defaultSelected re-applies to every
    // field (incl. the sex <select>) and survives React 19's post-action form reset.
    <form
      key={hasDuplicateWarning ? `warn:${state.warnedFingerprint ?? ""}` : "fresh"}
      action={formAction}
      className="space-y-8"
    >
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          {t("sectionPrincipal")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("familyName")} error={err.familyName}>
            <Input name="familyName" autoComplete="off" defaultValue={v?.familyName ?? ""} required />
          </Field>
          <Field label={t("givenName")} error={err.givenName}>
            <Input name="givenName" autoComplete="off" defaultValue={v?.givenName ?? ""} required />
          </Field>
          <Field label={t("sexLabel")} error={err.sex}>
            <select
              name="sex"
              defaultValue={v?.sex ?? ""}
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
            <Input name="dateOfBirth" type="date" defaultValue={v?.dateOfBirth ?? ""} />
          </Field>
          <Field label={t("estimatedAge")} error={err.estimatedAge}>
            <Input
              name="estimatedAge"
              type="number"
              min={0}
              max={130}
              autoComplete="off"
              defaultValue={v?.estimatedAge ?? ""}
            />
          </Field>
        </div>
        <p className="text-muted-foreground text-xs">{t("ageHint")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          {t("sectionComplementaire")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("phone")} error={err.phone}>
            <Input name="phone" type="tel" autoComplete="off" defaultValue={v?.phone ?? ""} />
          </Field>
          <Field label={t("guardianPhone")} error={err.guardianPhone}>
            <Input name="guardianPhone" type="tel" autoComplete="off" defaultValue={v?.guardianPhone ?? ""} />
          </Field>
          <Field label={t("residence")} error={err.residence}>
            <Input name="residence" autoComplete="off" defaultValue={v?.residence ?? ""} />
          </Field>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      {hasDuplicateWarning ? (
        <>
          <DuplicateWarning candidates={duplicates} />
          {/* Carries the acknowledgement on the next submit. No merge, no block — the
              user simply continues. Present only while the warning is shown. */}
          <input type="hidden" name="confirmDuplicate" value="1" />
        </>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button asChild type="button" variant="outline">
          <Link href="/patients">{tActions("cancel")}</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {hasDuplicateWarning ? t("createAnyway") : tActions("save")}
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
