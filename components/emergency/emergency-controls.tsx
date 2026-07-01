"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accrueEmergencyDebtAction,
  flagEmergencyAction,
  settleEmergencyDebtAction,
  waiveEmergencyDebtAction,
  type EmergencyFormState,
} from "@/server/actions/emergency-actions";

export type EmergencyDebtRow = {
  id: string;
  amountLabel: string;
  source: string;
  status: "outstanding" | "settled" | "waived";
  decisionReason: string | null;
};

const initial: EmergencyFormState = {};

export function EmergencyControls({
  encounterId,
  isEmergency,
  entries,
  outstandingLabel,
  caps,
}: {
  encounterId: string;
  isEmergency: boolean;
  entries: EmergencyDebtRow[];
  outstandingLabel: string;
  caps: { flag: boolean; accrue: boolean; settle: boolean; waive: boolean };
}) {
  const t = useTranslations("emergency");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<EmergencyFormState>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
    });

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>{t("status")}:</span>
        {isEmergency ? <Badge variant="destructive">{t("emergency")}</Badge> : <Badge variant="outline">{t("normal")}</Badge>}
        {caps.flag ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => flagEmergencyAction(encounterId, !isEmergency))}
          >
            {isEmergency ? t("unflag") : t("flag")}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      {isEmergency ? (
        <>
          <p>
            {t("outstanding")}: <span className="font-semibold">{outstandingLabel}</span>
          </p>

          {caps.accrue ? <AccrueForm encounterId={encounterId} /> : null}

          {entries.length > 0 ? (
            <ul className="space-y-2 border-t pt-2">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{e.amountLabel}</span>{" "}
                    <span className="text-muted-foreground text-xs">{e.source}</span>{" "}
                    <Badge variant={e.status === "outstanding" ? "secondary" : e.status === "waived" ? "destructive" : "default"}>
                      {t(`debtStatus_${e.status}`)}
                    </Badge>
                    {e.decisionReason ? (
                      <span className="text-muted-foreground text-xs"> — {e.decisionReason}</span>
                    ) : null}
                  </span>
                  {e.status === "outstanding" ? (
                    <span className="flex items-center gap-2">
                      {caps.settle ? (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => settleEmergencyDebtAction(encounterId, e.id))}>
                          {t("settle")}
                        </Button>
                      ) : null}
                      {caps.waive ? <WaiveForm encounterId={encounterId} debtId={e.id} /> : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function AccrueForm({ encounterId }: { encounterId: string }) {
  const t = useTranslations("emergency");
  const [state, action, pending] = useActionState(accrueEmergencyDebtAction.bind(null, encounterId), initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-2">
      <div className="grid gap-1">
        <Label htmlFor="em-amount" className="text-xs">
          {t("amount")}
        </Label>
        <Input id="em-amount" name="amount" type="number" min={1} step={1} className="w-32" required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="em-source" className="text-xs">
          {t("source")}
        </Label>
        <Input id="em-source" name="source" className="w-56" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("accrue")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function WaiveForm({ encounterId, debtId }: { encounterId: string; debtId: string }) {
  const t = useTranslations("emergency");
  const [state, action, pending] = useActionState(
    waiveEmergencyDebtAction.bind(null, encounterId, debtId),
    initial,
  );
  return (
    <form action={action} className="flex items-end gap-1">
      <Input name="reason" placeholder={t("waiveReason")} className="h-8 w-48 text-xs" required />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {t("waive")}
      </Button>
      {state.error ? (
        <span role="alert" className="text-destructive text-xs">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
