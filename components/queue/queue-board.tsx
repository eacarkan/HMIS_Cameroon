"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  advanceQueueAction,
  toggleQueueUrgentAction,
} from "@/server/actions/queue-actions";
import { formatTicketNumber, isTerminalQueueStatus, type QueueStatusValue } from "@/lib/queue";

export type QueueTicketRow = {
  id: string;
  ticketNumber: number;
  status: QueueStatusValue;
  isUrgent: boolean;
  patient: { familyName: string; givenName: string; patientNumber: string };
};

/** Phase 2F — the live queue board: status advance + the triage urgent toggle. */
export function QueueBoard({
  tickets,
  canManage,
  canUrgent,
}: {
  tickets: QueueTicketRow[];
  canManage: boolean;
  canUrgent: boolean;
}) {
  const t = useTranslations("queue");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
    });

  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }
  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {tickets.map((tk) => {
          const terminal = isTerminalQueueStatus(tk.status);
          return (
            <li
              key={tk.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm ${terminal ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="tnum text-lg font-semibold">{formatTicketNumber(tk.ticketNumber)}</span>
                <span>
                  {tk.patient.familyName} {tk.patient.givenName}{" "}
                  <span className="text-muted-foreground text-xs">({tk.patient.patientNumber})</span>
                </span>
                {tk.isUrgent ? <Badge variant="destructive">{t("urgent")}</Badge> : null}
                <Badge variant="secondary">{t(`status_${tk.status}`)}</Badge>
              </div>
              {!terminal ? (
                <div className="flex flex-wrap gap-2">
                  {canManage && tk.status === "waiting" ? (
                    <Button size="sm" disabled={pending} onClick={() => run(() => advanceQueueAction(tk.id, "in_service"))}>
                      {t("call")}
                    </Button>
                  ) : null}
                  {canManage && tk.status === "in_service" ? (
                    <Button size="sm" disabled={pending} onClick={() => run(() => advanceQueueAction(tk.id, "completed"))}>
                      {t("complete")}
                    </Button>
                  ) : null}
                  {canUrgent ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => toggleQueueUrgentAction(tk.id, !tk.isUrgent))}
                    >
                      {tk.isUrgent ? t("unmarkUrgent") : t("markUrgent")}
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => advanceQueueAction(tk.id, "cancelled"))}>
                      {t("cancel")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
