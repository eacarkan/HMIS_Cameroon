"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestCancellationAction,
  type CancellationFormState,
} from "@/server/actions/cancellation-actions";

const initial: CancellationFormState = {};

/**
 * Cashier requests an invoice cancellation with a mandatory reason (Phase 2C). This does NOT cancel
 * the invoice — a Hospital Administrator must approve it (cashier ≠ approver), and a paid invoice
 * then yields a refund voucher. Enforced server-side.
 */
export function RequestCancellationForm({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("cancellation");
  const [state, action, pending] = useActionState(
    requestCancellationAction.bind(null, invoiceId),
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-1.5">
        <Label htmlFor="cancel-reason" className="text-xs">
          {t("requestReason")}
        </Label>
        <Input
          id="cancel-reason"
          name="reason"
          required
          placeholder={t("requestReasonPlaceholder")}
        />
      </div>
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {t("requestAction")}
      </Button>
      {state.ok ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("requestSubmitted")}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
