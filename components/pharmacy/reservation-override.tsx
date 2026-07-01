"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { overrideFefoAction, type FefoFormState } from "@/server/actions/fefo-actions";

type Candidate = { id: string; batchNumber: string; expiryLabel: string; available: number };
export type ReservationRow = {
  id: string;
  quantity: number;
  unit: string;
  medicationLabel: string;
  isFefoOverride: boolean;
  overrideReason: string | null;
  batch: { batchNumber: string; expiryLabel: string };
  isCurrentFefo: boolean;
  candidates: Candidate[];
};

const initial: FefoFormState = {};

/**
 * Phase 2D-6 — active reservations for a prescription. Pharmacy/oversight see the reserved batch (and
 * whether it is the FEFO choice); the Pharmacist-in-Charge (`canOverride`) may re-point a reservation
 * to a chosen non-FEFO batch with a mandatory reason (audited `fefo.override`).
 */
export function ReservationOverridePanel({
  prescriptionId,
  reservations,
  canOverride,
}: {
  prescriptionId: string;
  reservations: ReservationRow[];
  canOverride: boolean;
}) {
  const t = useTranslations("fefo");
  if (reservations.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noReservations")}</p>;
  }
  return (
    <ul className="space-y-3">
      {reservations.map((r) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.medicationLabel}</span>
            <span className="text-muted-foreground text-xs">
              {t("batch")} {r.batch.batchNumber} · {t("expiry")} {r.batch.expiryLabel} · {r.quantity}{" "}
              {r.unit}
            </span>
            {r.isFefoOverride ? (
              <Badge variant="secondary">{t("overridden")}</Badge>
            ) : r.isCurrentFefo ? (
              <Badge variant="outline">{t("fefo")}</Badge>
            ) : (
              <Badge variant="outline">{t("nonFefo")}</Badge>
            )}
          </div>
          {r.overrideReason ? (
            <p className="text-muted-foreground mt-1 text-xs">
              {t("reason")}: {r.overrideReason}
            </p>
          ) : null}
          {canOverride && r.candidates.length > 0 ? (
            <OverrideForm prescriptionId={prescriptionId} reservation={r} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function OverrideForm({
  prescriptionId,
  reservation,
}: {
  prescriptionId: string;
  reservation: ReservationRow;
}) {
  const t = useTranslations("fefo");
  const [state, action, pending] = useActionState(
    overrideFefoAction.bind(null, prescriptionId, reservation.id),
    initial,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2 border-t pt-2">
      <div className="grid gap-1">
        <label htmlFor={`batch-${reservation.id}`} className="text-muted-foreground text-xs">
          {t("chooseBatch")}
        </label>
        <select
          id={`batch-${reservation.id}`}
          name="toBatchId"
          aria-label={t("chooseBatch")}
          className="border-input bg-background h-9 w-64 rounded-md border px-2 text-sm"
        >
          {reservation.candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.batchNumber} — {t("expiry")} {c.expiryLabel} ({t("available")} {c.available})
            </option>
          ))}
        </select>
      </div>
      <Input
        name="reason"
        aria-label={t("reasonPlaceholder")}
        placeholder={t("reasonPlaceholder")}
        className="h-9 w-64 text-sm"
        required
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("override")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
