"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeCashierShiftAction,
  voidInvoiceAction,
  type BillingFormState,
} from "@/server/actions/billing-actions";

const initial: BillingFormState = {};

/** Void / cancel an invoice with a mandatory reason (money-affecting → audited server-side). */
export function VoidInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("billing");
  const [state, action, pending] = useActionState(
    voidInvoiceAction.bind(null, invoiceId),
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-1.5">
        <Label htmlFor="void-reason" className="text-xs">
          {t("voidReason")}
        </Label>
        <Input id="void-reason" name="reason" required placeholder={t("voidReasonPlaceholder")} />
      </div>
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {t("void")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Close the cashier's shift for the displayed date (audited totals by mode). */
export function CloseShiftButton({ date }: { date: string }) {
  const t = useTranslations("cashierReport");
  const [state, action, pending] = useActionState(
    closeCashierShiftAction.bind(null, date),
    initial,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        {t("closeShift")}
      </Button>
      {state.ok ? <p className="text-muted-foreground text-xs">{t("shiftClosed")}</p> : null}
      {state.error ? <p className="text-destructive text-xs">{state.error}</p> : null}
    </form>
  );
}
