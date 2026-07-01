"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createClaimAction,
  createCoverageProfileAction,
  createPayerAction,
  decidePreAuthAction,
  type InsuranceFormState,
  linkCoverageAction,
  transitionClaimAction,
} from "@/server/actions/insurance-actions";

/**
 * Phase 4E — insurance / mutuelle admin forms (client). Thin wrappers over the server actions →
 * insurance service (RBAC + hospital scoping + audit). MANUAL only — no insurer API, no auto-submission.
 */

const initial: InsuranceFormState = {};
type Opt = { id: string; label: string };

function Feedback({ state }: { state: InsuranceFormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function CreatePayerForm() {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(createPayerAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">{t("code")}<Input name="code" className="h-9 w-36" placeholder="CNPS" required /></label>
      <label className="grid gap-1 text-xs">{t("name")}<Input name="name" className="h-9 w-48" required /></label>
      <label className="grid gap-1 text-xs">{t("kind")}<Input name="kind" className="h-9 w-36" defaultValue="MUTUELLE" required /></label>
      <Button type="submit" size="sm" disabled={pending}>{t("createPayer")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function CoverageProfileForm({ payerId }: { payerId: string }) {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(createCoverageProfileAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="payerId" value={payerId} />
      <label className="grid gap-1 text-xs">{t("profileCode")}<Input name="code" className="h-9 w-32" required /></label>
      <label className="grid gap-1 text-xs">{t("profileName")}<Input name="name" className="h-9 w-40" required /></label>
      <label className="grid gap-1 text-xs">{t("percent")}<Input name="coveragePercent" type="number" min="0" max="100" className="h-9 w-20" defaultValue="80" /></label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{t("addProfile")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function LinkCoverageForm({ payers }: { payers: Opt[] }) {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(linkCoverageAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">{t("patientId")}<Input name="patientId" className="h-9 w-56" required /></label>
      <label className="grid gap-1 text-xs">
        {t("payer")}
        <select name="payerId" className="border-input bg-background h-9 rounded-md border px-2 text-sm" required>
          {payers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">{t("memberNumber")}<Input name="memberNumber" className="h-9 w-36" required /></label>
      <Button type="submit" size="sm" disabled={pending}>{t("linkCoverage")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ClaimForm({ coverages }: { coverages: Opt[] }) {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(createClaimAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">
        {t("coverage")}
        <select name="coverageId" className="border-input bg-background h-9 rounded-md border px-2 text-sm" required>
          {coverages.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">{t("amount")}<Input name="amountClaimed" type="number" min="1" className="h-9 w-28" required /></label>
      <label className="grid gap-1 text-xs">{t("invoiceId")}<Input name="invoiceId" className="h-9 w-48" /></label>
      <Button type="submit" size="sm" disabled={pending}>{t("createClaim")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ClaimActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(transitionClaimAction, initial);
  const next: { to: string; label: string }[] =
    status === "DRAFT" ? [{ to: "SUBMITTED_PLACEHOLDER", label: t("submit") }]
      : status === "SUBMITTED_PLACEHOLDER" ? [{ to: "UNDER_REVIEW", label: t("review") }]
      : status === "UNDER_REVIEW" ? [{ to: "ACCEPTED", label: t("accept") }, { to: "REJECTED", label: t("reject") }]
      : [];
  if (next.length === 0) return null;
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {next.map((n) => (
        <Button key={n.to} type="submit" name="to" value={n.to} size="sm" variant="outline" disabled={pending}>{n.label}</Button>
      ))}
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}

export function PreAuthActions({ id }: { id: string }) {
  const t = useTranslations("insurance");
  const [state, action, pending] = useActionState(decidePreAuthAction, initial);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="reason" className="h-8 w-40" placeholder={t("reason")} />
      <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>{t("approve")}</Button>
      <Button type="submit" name="decision" value="reject" size="sm" variant="outline" disabled={pending}>{t("reject")}</Button>
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}
