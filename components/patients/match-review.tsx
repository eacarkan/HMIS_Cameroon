"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateCandidatesAction,
  type MatchFormState,
  mockMpiCheckAction,
  recordDecisionAction,
  startReviewAction,
} from "@/server/actions/patient-match-actions";

/**
 * Phase 4G — patient-match review forms (client). Thin wrappers over the server actions → matching
 * service (RBAC + hospital scoping + audit). Warning-only, manual review; NO automatic merge; a decision
 * records judgment only. Mock MPI — no live call.
 */

const initial: MatchFormState = {};

function Feedback({ state }: { state: MatchFormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function GenerateCandidatesForm() {
  const t = useTranslations("patientMatch");
  const [state, action, pending] = useActionState(generateCandidatesAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" disabled={pending}>{t("generate")}</Button>
      <span className="text-muted-foreground text-xs">{t("generateHint")}</span>
      <Feedback state={state} />
    </form>
  );
}

export function StartReviewForm({ id }: { id: string }) {
  const t = useTranslations("patientMatch");
  const [state, action, pending] = useActionState(startReviewAction, initial);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{t("startReview")}</Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}

export function DecisionForm({ id }: { id: string }) {
  const t = useTranslations("patientMatch");
  const [state, action, pending] = useActionState(recordDecisionAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1 text-xs">
        {t("reason")} <span className="text-destructive">*</span>
        <Input name="reason" className="h-9 w-full" placeholder={t("reasonPlaceholder")} required />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="decision" value="MARKED_DUPLICATE" size="sm" disabled={pending}>{t("markDuplicate")}</Button>
        <Button type="submit" name="decision" value="MARKED_NOT_DUPLICATE" size="sm" variant="outline" disabled={pending}>{t("markNotDuplicate")}</Button>
        <Button type="submit" name="decision" value="NEEDS_MORE_INFORMATION" size="sm" variant="outline" disabled={pending}>{t("needsInfo")}</Button>
        <Button type="submit" name="decision" value="DISMISSED" size="sm" variant="ghost" disabled={pending}>{t("dismiss")}</Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("noMergeNotice")}</p>
      <Feedback state={state} />
    </form>
  );
}

export function MockMpiForm({ id }: { id: string }) {
  const t = useTranslations("patientMatch");
  const [state, action, pending] = useActionState(mockMpiCheckAction, initial);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>{t("mockMpiCheck")}</Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : state.ok ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
