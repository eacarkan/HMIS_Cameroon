"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createIntentAction,
  createProviderAction,
  type PaymentFormState,
  paymentActionByDecision,
} from "@/server/actions/external-payment-actions";

/**
 * Phase 4D — payment-provider admin forms (client). Thin wrappers over the server actions → payment
 * service (finance-gated + audited). MOCK only: a confirmation never marks an invoice paid; reconcile
 * records a controlled payment through the existing billing rule.
 */

const initial: PaymentFormState = {};

function Feedback({ state }: { state: PaymentFormState }) {
  if (state.error) return <p role="alert" className="text-destructive text-xs">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-xs text-emerald-700">{state.message}</p>;
  return null;
}

export function CreateProviderForm() {
  const t = useTranslations("externalPayment");
  const [state, action, pending] = useActionState(createProviderAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs">
        {t("code")}
        <Input name="code" className="h-9 w-40" placeholder="MTN_MOMO" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("name")}
        <Input name="name" className="h-9 w-44" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("channel")}
        <Input name="channel" className="h-9 w-40" defaultValue="MOBILE_MONEY" required />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {t("createProvider")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function CreateIntentForm({ providerId }: { providerId: string }) {
  const t = useTranslations("externalPayment");
  const [state, action, pending] = useActionState(createIntentAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="providerId" value={providerId} />
      <label className="grid gap-1 text-xs">
        {t("reference")}
        <Input name="externalReference" className="h-9 w-36" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("amount")}
        <Input name="amount" type="number" min="1" step="1" className="h-9 w-28" required />
      </label>
      <label className="grid gap-1 text-xs">
        {t("invoiceId")}
        <Input name="invoiceId" className="h-9 w-56" />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("createIntent")}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function TxnActions({ id, status, reconciled }: { id: string; status: string; reconciled: boolean }) {
  const t = useTranslations("externalPayment");
  const [state, action, pending] = useActionState(paymentActionByDecision, initial);
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {status === "PENDING" ? (
        <>
          <Button type="submit" name="decision" value="confirm" size="sm" disabled={pending}>
            {t("confirm")}
          </Button>
          <Button type="submit" name="decision" value="cancel" size="sm" variant="outline" disabled={pending}>
            {t("cancel")}
          </Button>
        </>
      ) : null}
      {status === "CONFIRMED" && !reconciled ? (
        <Button type="submit" name="decision" value="reconcile" size="sm" disabled={pending}>
          {t("reconcile")}
        </Button>
      ) : null}
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}
