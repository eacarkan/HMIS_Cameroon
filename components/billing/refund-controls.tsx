"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveRefundAction,
  cancelRefundAction,
  executeRefundAction,
  type RefundFormState,
} from "@/server/actions/refund-actions";

const initial: RefundFormState = {};

/**
 * Refund voucher transitions (Phase 2C). Approve (admin) on `requested`; execute (cashier) on
 * `approved`; cancel (admin) on `requested`/`approved`. The server guards the state machine and
 * the capabilities; these buttons only appear when the action is applicable to the actor.
 */
export function RefundActions({
  id,
  status,
  canApprove,
  canExecute,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canExecute: boolean;
}) {
  const t = useTranslations("refund");
  const [apState, approve, apPending] = useActionState(approveRefundAction.bind(null, id), initial);
  const [exState, execute, exPending] = useActionState(executeRefundAction.bind(null, id), initial);
  const [caState, cancel, caPending] = useActionState(cancelRefundAction.bind(null, id), initial);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canApprove && status === "requested" ? (
          <form action={approve}>
            <Button type="submit" size="sm" disabled={apPending}>
              {t("approve")}
            </Button>
          </form>
        ) : null}
        {canExecute && status === "approved" ? (
          <form action={execute}>
            <Button type="submit" size="sm" disabled={exPending}>
              {t("execute")}
            </Button>
          </form>
        ) : null}
      </div>
      {canApprove && (status === "requested" || status === "approved") ? (
        <form action={cancel} className="flex items-end gap-2">
          <Input
            name="reason"
            placeholder={t("cancelReasonPlaceholder")}
            className="h-8 text-sm"
            required
          />
          <Button type="submit" size="sm" variant="destructive" disabled={caPending}>
            {t("cancel")}
          </Button>
        </form>
      ) : null}
      {apState.error ?? exState.error ?? caState.error ? (
        <p role="alert" className="text-destructive text-xs">
          {apState.error ?? exState.error ?? caState.error}
        </p>
      ) : null}
    </div>
  );
}
