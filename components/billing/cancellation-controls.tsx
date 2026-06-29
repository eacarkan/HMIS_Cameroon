"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveCancellationAction,
  rejectCancellationAction,
  type CancellationFormState,
} from "@/server/actions/cancellation-actions";

const initial: CancellationFormState = {};

/** Administrator decides a pending cancellation request: approve (optional reason) or reject
 *  (mandatory reason). The server enforces requester ≠ approver. Phase 2C. */
export function DecideCancellationForms({ requestId }: { requestId: string }) {
  const t = useTranslations("cancellation");
  const [aState, approve, aPending] = useActionState(
    approveCancellationAction.bind(null, requestId),
    initial,
  );
  const [rState, reject, rPending] = useActionState(
    rejectCancellationAction.bind(null, requestId),
    initial,
  );
  return (
    <div className="space-y-2">
      <form action={approve} className="flex items-end gap-2">
        <Input
          name="decisionReason"
          placeholder={t("decisionReasonPlaceholder")}
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" disabled={aPending}>
          {t("approve")}
        </Button>
      </form>
      <form action={reject} className="flex items-end gap-2">
        <Input
          name="decisionReason"
          placeholder={t("decisionReasonPlaceholder")}
          className="h-8 text-sm"
          required
        />
        <Button type="submit" size="sm" variant="destructive" disabled={rPending}>
          {t("reject")}
        </Button>
      </form>
      {aState.error ?? rState.error ? (
        <p role="alert" className="text-destructive text-xs">
          {aState.error ?? rState.error}
        </p>
      ) : null}
    </div>
  );
}
