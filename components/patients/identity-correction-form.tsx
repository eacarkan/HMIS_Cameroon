"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  correctPatientIdentityAction,
  type PatientFormState,
} from "@/server/actions/patient-actions";

const initial: PatientFormState = {};

/**
 * Identity-correction form (Phase 2B) for a temporary/unidentified patient. Confirms the
 * real identity; the service preserves the original temporary ID in the audit log.
 */
export function IdentityCorrectionForm({ patientId }: { patientId: string }) {
  const t = useTranslations("patient");
  const tSex = useTranslations("sex");
  const tActions = useTranslations("actions");
  const [state, action, pending] = useActionState(
    correctPatientIdentityAction.bind(null, patientId),
    initial,
  );
  const err = state.errors ?? {};
  return (
    <form action={action} className="mt-3 space-y-4">
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
          <Input name="dateOfBirth" type="date" />
        </Field>
        <Field label={t("estimatedAge")} error={err.estimatedAge}>
          <Input name="estimatedAge" type="number" min={0} max={130} autoComplete="off" />
        </Field>
        <Field label={t("phone")} error={err.phone}>
          <Input name="phone" type="tel" autoComplete="off" />
        </Field>
        <Field label={t("guardianPhone")} error={err.guardianPhone}>
          <Input name="guardianPhone" type="tel" autoComplete="off" />
        </Field>
        <Field label={t("residence")} error={err.residence}>
          <Input name="residence" autoComplete="off" />
        </Field>
      </div>
      <p className="text-muted-foreground text-xs">{t("ageHint")}</p>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
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
