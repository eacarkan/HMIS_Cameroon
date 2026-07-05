"use client";

import { useActionState, useState } from "react";
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
// Phase 6.6 — synthetic demo operators (Cameroon Mobile Money). "AUTRE" covers any other wallet.
const MOMO_OPERATORS = ["MTN", "ORANGE", "AUTRE"] as const;

/** Payment capture (06 §12): montant + mode de paiement → Encaisser. Phase 6.6 adds the optional
 * Mobile-Money operator + reference snapshot, shown only when the method is `mobile_money`. */
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
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");
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
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
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

      {method === "mobile_money" ? (
        <div className="border-input bg-muted/30 flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3">
          <div className="space-y-1.5">
            <Label htmlFor="mobileMoneyOperator">{t("momoOperator")}</Label>
            <select
              id="mobileMoneyOperator"
              name="mobileMoneyOperator"
              defaultValue="MTN"
              className="border-input bg-background h-9 w-40 rounded-md border px-3 text-sm shadow-xs"
            >
              {MOMO_OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobileMoneyReference">{t("momoReference")}</Label>
            <Input
              id="mobileMoneyReference"
              name="mobileMoneyReference"
              placeholder={t("momoReferencePlaceholder")}
              className="w-56"
            />
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
