"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveAdjustmentAction,
  rejectAdjustmentAction,
  requestAdjustmentAction,
  type AdjustmentFormState,
} from "@/server/actions/stock-adjustment-actions";
import { STOCK_ADJUSTMENT_TYPES } from "@/lib/stock-adjustment";

type BatchOption = { id: string; label: string };
const initial: AdjustmentFormState = {};

/** Phase 2D-7 — a pharmacist requests a stock adjustment (batch + type + quantity + reason). */
export function RequestAdjustmentForm({ batches }: { batches: BatchOption[] }) {
  const t = useTranslations("stockAdjustment");
  const [state, action, pending] = useActionState(requestAdjustmentAction, initial);
  if (batches.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noBatches")}</p>;
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="adj-batch">{t("batch")}</Label>
        <select
          id="adj-batch"
          name="batchId"
          className="border-input bg-background h-9 w-72 rounded-md border px-2 text-sm"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-type">{t("type")}</Label>
        <select
          id="adj-type"
          name="type"
          className="border-input bg-background h-9 w-44 rounded-md border px-2 text-sm"
        >
          {STOCK_ADJUSTMENT_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {t(`type_${tp}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-qty">{t("quantity")}</Label>
        <Input id="adj-qty" name="quantity" type="number" min={1} step={1} className="w-24" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="adj-reason">{t("reason")}</Label>
        <Input id="adj-reason" name="reason" className="w-64" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("request")}
      </Button>
      {state.ok ? (
        <p className="text-muted-foreground w-full text-sm">{t("requested")}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Phase 2D-7 — the Pharmacist-in-Charge approves (optional reason) or rejects (mandatory reason). */
export function DecideAdjustmentForms({ adjustmentId }: { adjustmentId: string }) {
  const t = useTranslations("stockAdjustment");
  const [aState, approve, aPending] = useActionState(
    approveAdjustmentAction.bind(null, adjustmentId),
    initial,
  );
  const [rState, reject, rPending] = useActionState(
    rejectAdjustmentAction.bind(null, adjustmentId),
    initial,
  );
  return (
    <div className="space-y-2">
      <form action={approve} className="flex items-end gap-2">
        <Input name="decisionReason" placeholder={t("decisionReasonPlaceholder")} className="h-8 text-sm" />
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
