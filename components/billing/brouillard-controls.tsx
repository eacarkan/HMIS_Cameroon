"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeShiftAction,
  correctShiftAction,
  openShiftAction,
  type ShiftFormState,
} from "@/server/actions/cashier-shift-actions";

const initial: ShiftFormState = {};

/** Open a Brouillard with an opening cash balance (integer FCFA). Phase 2C. */
export function OpenShiftForm() {
  const t = useTranslations("brouillard");
  const [state, action, pending] = useActionState(openShiftAction, initial);
  return (
    <form action={action} className="flex items-end gap-2">
      <div className="grid gap-1.5">
        <Label htmlFor="openingBalance" className="text-xs">
          {t("openingBalance")}
        </Label>
        <Input
          id="openingBalance"
          name="openingBalance"
          type="number"
          min={0}
          step={1}
          defaultValue={0}
          className="h-9 w-44"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("open")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Close the open Brouillard — freezes the five totals (immutable thereafter). */
export function CloseShiftButton({ shiftId }: { shiftId: string }) {
  const t = useTranslations("brouillard");
  const [state, action, pending] = useActionState(closeShiftAction.bind(null, shiftId), initial);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        {t("close")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Append a controlled correction to a CLOSED Brouillard (frozen figures never change). */
export function CorrectShiftForm({ shiftId }: { shiftId: string }) {
  const t = useTranslations("brouillard");
  const [state, action, pending] = useActionState(correctShiftAction.bind(null, shiftId), initial);
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-1.5">
        <Label htmlFor="correct-reason" className="text-xs">
          {t("correctReason")}
        </Label>
        <Input id="correct-reason" name="reason" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="correct-note" className="text-xs">
          {t("correctNote")}
        </Label>
        <Input
          id="correct-note"
          name="note"
          required
          placeholder={t("correctNotePlaceholder")}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("correct")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("correctionNotice")}</p>
      {state.error ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
