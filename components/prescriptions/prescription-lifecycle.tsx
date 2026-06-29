"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  cancelPrescriptionAction,
  finalizePrescriptionAction,
  sendPrescriptionAction,
  type PrescriptionFormState,
} from "@/server/actions/prescription-actions";

const initial: PrescriptionFormState = {};

/**
 * Prescription lifecycle controls (Phase 2D-2). Finalize a draft, send a finalized prescription to
 * the pharmacy, or cancel a non-terminal one. The server guards the state machine + capability; the
 * buttons only show the transition that applies to the current status.
 */
export function PrescriptionLifecycle({ id, status }: { id: string; status: string }) {
  const t = useTranslations("prescription");
  const [fState, finalize, fPending] = useActionState(
    finalizePrescriptionAction.bind(null, id),
    initial,
  );
  const [sState, send, sPending] = useActionState(sendPrescriptionAction.bind(null, id), initial);
  const [cState, cancel, cPending] = useActionState(cancelPrescriptionAction.bind(null, id), initial);

  const terminal = status === "dispensed" || status === "cancelled";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <form action={finalize}>
            <Button type="submit" size="sm" disabled={fPending}>
              {t("finalize")}
            </Button>
          </form>
        ) : null}
        {status === "finalized" ? (
          <form action={send}>
            <Button type="submit" size="sm" disabled={sPending}>
              {t("sendToPharmacy")}
            </Button>
          </form>
        ) : null}
        {!terminal ? (
          <form action={cancel}>
            <Button type="submit" size="sm" variant="destructive" disabled={cPending}>
              {t("cancel")}
            </Button>
          </form>
        ) : null}
      </div>
      {fState.error ?? sState.error ?? cState.error ? (
        <p role="alert" className="text-destructive text-xs">
          {fState.error ?? sState.error ?? cState.error}
        </p>
      ) : null}
    </div>
  );
}
