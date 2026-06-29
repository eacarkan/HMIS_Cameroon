"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPriceListAction,
  deactivatePriceListAction,
  createTariffAction,
  deactivateTariffAction,
} from "@/server/actions/tariff-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * Tariff / price-list create/deactivate forms (Gate 4, client) → Gate 3 tariff-service
 * (admin-only mutation, integer FCFA, audited). Shown only when the actor may manage
 * tariffs; the cashier sees read-only tariffs (and uses them in billing), never these forms.
 */
const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function CreatePriceListForm() {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createPriceListAction, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="pl-code">{t("code")}</Label>
        <Input id="pl-code" name="code" className="w-32" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pl-name">{t("name")}</Label>
        <Input id="pl-name" name="name" className="w-56" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("add")}
      </Button>
      <FormError state={state} />
    </form>
  );
}

export function CreateTariffForm({
  priceLists,
}: {
  priceLists: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(createTariffAction, initial);
  return (
    <form action={action} className="mt-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tf-code">{t("code")}</Label>
          <Input id="tf-code" name="code" className="w-40" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tf-label">{t("name")}</Label>
          <Input id="tf-label" name="label" className="w-56" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tf-amount">{t("amount")}</Label>
          <Input id="tf-amount" name="amount" type="number" min={0} step={1} className="w-32" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tf-pl">{t("priceLists")}</Label>
          <select
            id="tf-pl"
            name="priceListId"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">{t("departmentNone")}</option>
            {priceLists.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </div>
        {/* Phase 2C — optional effective dates (never alter existing invoice snapshots). */}
        <div className="grid gap-1.5">
          <Label htmlFor="tf-from">{t("effectiveFrom")}</Label>
          <Input id="tf-from" name="effectiveFrom" type="date" className="w-40" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tf-to">{t("effectiveTo")}</Label>
          <Input id="tf-to" name="effectiveTo" type="date" className="w-40" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("add")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("integerFcfaHint")}</p>
      <FormError state={state} />
    </form>
  );
}

export function DeactivateTariffButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  return (
    <form action={deactivateTariffAction.bind(null, id)}>
      <Button type="submit" variant="ghost" size="sm">
        {t("deactivate")}
      </Button>
    </form>
  );
}

export function DeactivatePriceListButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  return (
    <form action={deactivatePriceListAction.bind(null, id)}>
      <Button type="submit" variant="ghost" size="sm">
        {t("deactivate")}
      </Button>
    </form>
  );
}
