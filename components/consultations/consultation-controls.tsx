"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  amendConsultationAction,
  finalizeConsultationAction,
  type ConsultationFormState,
} from "@/server/actions/consultation-actions";

const initial: ConsultationFormState = {};

type AmendValues = {
  clinicalNote: string | null;
  vitals: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
};

/** Finalize a draft consultation (draft → finalized). */
export function FinalizeConsultationButton({ consultationId }: { consultationId: string }) {
  const t = useTranslations("consultation");
  const [state, action, pending] = useActionState(
    finalizeConsultationAction.bind(null, consultationId),
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" size="sm" disabled={pending}>
        {t("finalize")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Amend a finalized consultation — a traced correction. */
export function AmendConsultationForm({
  consultationId,
  values,
}: {
  consultationId: string;
  values: AmendValues;
}) {
  const t = useTranslations("consultation");
  const [state, action, pending] = useActionState(
    amendConsultationAction.bind(null, consultationId),
    initial,
  );
  return (
    <form action={action} className="space-y-3">
      <p className="text-muted-foreground text-xs">{t("amendHint")}</p>
      <Field label={t("vitals")}>
        <Input name="vitals" defaultValue={values.vitals ?? ""} />
      </Field>
      <Field label={t("clinicalNote")}>
        <textarea
          name="clinicalNote"
          defaultValue={values.clinicalNote ?? ""}
          rows={3}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t("provisionalDiagnosis")}>
        <Input name="provisionalDiagnosis" defaultValue={values.provisionalDiagnosis ?? ""} />
      </Field>
      <Field label={t("recommendation")}>
        <textarea
          name="recommendation"
          defaultValue={values.recommendation ?? ""}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t("amend")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
