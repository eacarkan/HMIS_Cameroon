"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  receiveStockBatchAction,
  type StockFormState,
} from "@/server/actions/stock-actions";

type Med = { id: string; label: string };
const initial: StockFormState = {};

/** Phase 2D-3 — receive a medication stock batch (pharmacy): medication, batch number, expiry, qty. */
export function ReceiveStockForm({ medications }: { medications: Med[] }) {
  const t = useTranslations("stock");
  const [state, action, pending] = useActionState(receiveStockBatchAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="st-med">{t("medication")}</Label>
        <select
          id="st-med"
          name="medicationId"
          className="border-input bg-background h-9 w-56 rounded-md border px-2 text-sm"
        >
          {medications.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="st-batch">{t("batchNumber")}</Label>
        <Input id="st-batch" name="batchNumber" className="w-36" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="st-expiry">{t("expiry")}</Label>
        <Input id="st-expiry" name="expiryDate" type="date" className="w-44" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="st-qty">{t("quantity")}</Label>
        <Input id="st-qty" name="quantity" type="number" min={1} step={1} className="w-28" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("receive")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
