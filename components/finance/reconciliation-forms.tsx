"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeStatusAction,
  createSlipAction,
  importStatementAction,
  linkPaymentAction,
  matchBankLineAction,
  type ReconFormState,
  unlinkPaymentAction,
} from "@/server/actions/reconciliation-actions";

const initial: ReconFormState = {};

function Feedback({ state }: { state: ReconFormState }) {
  if (state.error) return <p role="alert" className="text-destructive mt-1 text-sm">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="mt-1 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function NewSlipForm() {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(createSlipAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="declaredTotalFcfa">{t("reconciliation.declaredTotal")}</Label>
        <Input id="declaredTotalFcfa" name="declaredTotalFcfa" type="number" min={0} defaultValue={0} className="tnum w-40" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">{t("reconciliation.label")}</Label>
        <Input id="note" name="note" className="w-56" />
      </div>
      <Button type="submit" disabled={pending}>{t("reconciliation.create")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function ImportStatementButton() {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(importStatementAction, initial);
  return (
    <form action={action} className="inline-flex flex-col">
      <Button type="submit" variant="outline" disabled={pending}>{t("reconciliation.importStatement")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function LinkPaymentForm({
  slipId,
  payments,
}: {
  slipId: string;
  payments: { id: string; receiptNumber: string; amount: number; label: string }[];
}) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(linkPaymentAction.bind(null, slipId), initial);
  if (payments.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("reconciliation.noLinked")}</p>;
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="paymentId">{t("reconciliation.availablePayments")}</Label>
        <select
          id="paymentId"
          name="paymentId"
          className="border-input bg-background h-9 w-72 rounded-md border px-3 text-sm shadow-xs"
        >
          {payments.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>{t("reconciliation.linkPayment")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function UnlinkButton({ slipId, paymentId }: { slipId: string; paymentId: string }) {
  const t = useTranslations("finance");
  const [, action, pending] = useActionState(unlinkPaymentAction.bind(null, slipId, paymentId), initial);
  return (
    <form action={action} className="inline">
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>{t("reconciliation.unlink")}</Button>
    </form>
  );
}

export function MatchForm({
  slipId,
  bankLineId,
  defaultAmount,
}: {
  slipId: string;
  bankLineId: string;
  defaultAmount: number;
}) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(matchBankLineAction.bind(null, slipId), initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="bankLineId" value={bankLineId} />
      <div className="space-y-1.5">
        <Label htmlFor={`amt-${bankLineId}`}>{t("reconciliation.matchAmount")}</Label>
        <Input id={`amt-${bankLineId}`} name="matchedAmountFcfa" type="number" min={1} defaultValue={defaultAmount} className="tnum w-36" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>{t("reconciliation.match")}</Button>
      <Feedback state={state} />
    </form>
  );
}

export function StatusButton({ slipId, to, label }: { slipId: string; to: string; label: string }) {
  const [state, action, pending] = useActionState(changeStatusAction.bind(null, slipId, to), initial);
  return (
    <span className="inline-flex flex-col">
      <form action={action} className="inline">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>{label}</Button>
      </form>
      <Feedback state={state} />
    </span>
  );
}
