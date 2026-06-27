"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordPaymentAction,
  type BillingFormState,
} from "@/server/actions/billing-actions";

const initialState: BillingFormState = {};
const METHODS = ["cash", "mobile_money", "card", "bank_transfer"] as const;

/** Payment capture (06 §12): montant + mode de paiement → Encaisser. */
export function PaymentForm({
  invoiceId,
  remaining,
}: {
  invoiceId: string;
  remaining: number;
}) {
  const t = useTranslations("billing");
  const tActions = useTranslations("actions");
  const tMethod = useTranslations("paymentMethod");
  const [state, formAction, pending] = useActionState(
    recordPaymentAction.bind(null, invoiceId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">{t("amount")}</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={1}
            defaultValue={remaining}
            className="tnum w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="method">{t("method")}</Label>
          <select
            id="method"
            name="method"
            defaultValue="cash"
            className="border-input bg-background h-9 w-44 rounded-md border px-3 text-sm shadow-xs"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {tMethod(m)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {tActions("collectPayment")}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
