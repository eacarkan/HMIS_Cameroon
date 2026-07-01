"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmDiagnosticPaymentAction,
  enterDiagnosticResultAction,
  startDiagnosticAction,
  validateDiagnosticResultAction,
  type DiagnosticFormState,
} from "@/server/actions/diagnostic-actions";

export type DiagnosticStatus =
  | "requested"
  | "payment_confirmed"
  | "in_progress"
  | "result_entered"
  | "validated"
  | "cancelled";

export type DiagnosticOrderRow = {
  id: string;
  encounterId: string;
  orderNumber: string;
  modality: "lab" | "radiology";
  itemLabel: string;
  status: DiagnosticStatus;
  isPaid: boolean;
  priceLabel: string;
  resultText: string | null;
  cancelReason: string | null;
};

export type DiagnosticCaps = { pay: boolean; enter: boolean; validate: boolean };

const initial: DiagnosticFormState = {};

const STATUS_VARIANT: Record<DiagnosticStatus, "secondary" | "default" | "destructive" | "outline"> = {
  requested: "secondary",
  payment_confirmed: "secondary",
  in_progress: "default",
  result_entered: "default",
  validated: "outline",
  cancelled: "destructive",
};

/** The per-order action cluster, reused on the encounter card and the lab/radiology worklist.
 *  `path` is the route to revalidate after a mutation (encounter page or worklist). */
export function DiagnosticOrderActions({
  order,
  caps,
  path,
}: {
  order: DiagnosticOrderRow;
  caps: DiagnosticCaps;
  path: string;
}) {
  const t = useTranslations("diagnostic");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<DiagnosticFormState>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{order.itemLabel}</span>
        <Badge variant="outline">{t(`modality_${order.modality}`)}</Badge>
        <Badge variant={STATUS_VARIANT[order.status]}>{t(`status_${order.status}`)}</Badge>
        <span className="text-muted-foreground tnum text-xs">{order.priceLabel}</span>
        <span className="text-muted-foreground text-xs">{order.isPaid ? t("paid") : t("unpaid")}</span>
      </div>

      {/* The validated result (or, for staff, the entered result) — visibility is enforced server-side. */}
      {order.resultText ? (
        <div className="rounded-md border bg-muted/30 p-2 text-sm whitespace-pre-wrap">{order.resultText}</div>
      ) : order.status === "result_entered" ? (
        <p className="text-muted-foreground text-xs italic">{t("awaitingValidation")}</p>
      ) : null}

      {order.status === "cancelled" && order.cancelReason ? (
        <p className="text-muted-foreground text-xs">
          {t("cancelReasonLabel")}: {order.cancelReason}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {caps.pay && order.status === "requested" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => confirmDiagnosticPaymentAction(path, order.id))}>
            {t("confirmPayment")}
          </Button>
        ) : null}

        {caps.enter && (order.status === "requested" || order.status === "payment_confirmed") ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => startDiagnosticAction(path, order.id))}>
            {t("start")}
          </Button>
        ) : null}

        {caps.validate && order.status === "result_entered" ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => validateDiagnosticResultAction(path, order.id))}>
            {t("validate")}
          </Button>
        ) : null}

        {order.status === "validated" ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/diagnostics/${order.id}/rapport`}>{t("printReport")}</Link>
          </Button>
        ) : null}
      </div>

      {caps.enter && order.status === "in_progress" ? (
        <ResultForm path={path} id={order.id} />
      ) : null}
    </div>
  );
}

function ResultForm({ path, id }: { path: string; id: string }) {
  const t = useTranslations("diagnostic");
  const [state, action, pending] = useActionState(
    enterDiagnosticResultAction.bind(null, path, id),
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <textarea
        name="resultText"
        rows={3}
        placeholder={t("resultPlaceholder")}
        required
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {t("saveResult")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
