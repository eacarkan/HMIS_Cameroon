"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  confirmPaymentAction,
  dispenseAction,
  type DispenseFormState,
} from "@/server/actions/dispensing-actions";

const initial: DispenseFormState = {};

/** Cashier confirms the prescription was paid at the cashier (Phase 2D-5). */
export function ConfirmPaymentButton({ prescriptionId }: { prescriptionId: string }) {
  const t = useTranslations("dispense");
  const [state, action, pending] = useActionState(
    confirmPaymentAction.bind(null, prescriptionId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        {t("confirmPayment")}
      </Button>
      {state.ok ? <p className="text-muted-foreground text-xs">{t("paymentConfirmed")}</p> : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Pharmacy dispenses (consumes reservations + deducts on-hand) — Phase 2D-5. */
export function DispenseButton({ prescriptionId }: { prescriptionId: string }) {
  const t = useTranslations("dispense");
  const [state, action, pending] = useActionState(
    dispenseAction.bind(null, prescriptionId),
    initial,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        {t("dispense")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
