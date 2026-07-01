"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ExternalResultFormState,
  importResultsAction,
  reviewResultAction,
} from "@/server/actions/external-result-actions";

/**
 * Phase 4C — external-result import + review forms (client). Thin wrappers over the server actions →
 * external-result service (staging + review; importer ≠ reviewer; audited). Imported data is STAGING —
 * it never appears in the doctor-visible validated-result area until reviewed, promoted, and validated.
 */

const initial: ExternalResultFormState = {};

function Feedback({ state }: { state: ExternalResultFormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function ImportForm() {
  const t = useTranslations("externalResult");
  const [state, action, pending] = useActionState(importResultsAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <label className="grid gap-1 text-xs">
        {t("source")}
        <Input name="source" className="h-9 w-40" defaultValue="CSV" />
      </label>
      <label className="grid gap-1 text-xs">
        {t("csv")}
        <textarea
          name="csv"
          rows={4}
          className="border-input bg-background rounded-md border p-2 font-mono text-xs"
          placeholder="externalRef,patientRef,orderRef,modality,testCode,resultText"
          defaultValue="externalRef,patientRef,orderRef,modality,testCode,resultText"
        />
      </label>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("import")}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ReviewForm({ id, canPromote }: { id: string; canPromote: boolean }) {
  const t = useTranslations("externalResult");
  const [state, action, pending] = useActionState(reviewResultAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-xs">
        {t("reason")}
        <Input name="reason" className="h-9 w-48" />
      </label>
      {canPromote ? (
        <Button type="submit" name="decision" value="promote" size="sm" disabled={pending}>
          {t("promote")}
        </Button>
      ) : null}
      <Button type="submit" name="decision" value="reject" size="sm" variant="outline" disabled={pending}>
        {t("reject")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}
