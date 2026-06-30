"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DiagnosticOrderActions,
  type DiagnosticCaps,
  type DiagnosticOrderRow,
} from "@/components/diagnostics/diagnostic-order-actions";
import {
  requestDiagnosticAction,
  type DiagnosticFormState,
} from "@/server/actions/diagnostic-actions";

const initial: DiagnosticFormState = {};

/** Phase 2I — the lab/radiology card on the encounter page: a request form (doctor) + the order list,
 *  each row carrying its capability-gated actions. The result stays hidden until validated (server). */
export function DiagnosticPanel({
  encounterId,
  orders,
  catalogue,
  caps,
  canRequest,
}: {
  encounterId: string;
  orders: DiagnosticOrderRow[];
  catalogue: { id: string; label: string }[];
  caps: DiagnosticCaps;
  canRequest: boolean;
}) {
  const t = useTranslations("diagnostic");
  return (
    <div className="space-y-4 text-sm">
      {canRequest ? <RequestForm encounterId={encounterId} catalogue={catalogue} /> : null}

      {orders.length === 0 ? (
        <p className="text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-md border p-3">
              <div className="text-muted-foreground tnum mb-1 text-xs">{o.orderNumber}</div>
              <DiagnosticOrderActions order={o} caps={caps} path={`/encounters/${encounterId}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestForm({
  encounterId,
  catalogue,
}: {
  encounterId: string;
  catalogue: { id: string; label: string }[];
}) {
  const t = useTranslations("diagnostic");
  const [state, action, pending] = useActionState(requestDiagnosticAction.bind(null, encounterId), initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-b pb-3">
      <div className="grid flex-1 gap-1">
        <Label htmlFor="diag-item" className="text-xs">
          {t("exam")}
        </Label>
        <select
          id="diag-item"
          name="catalogueItemId"
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          defaultValue=""
          required
        >
          <option value="" disabled>
            {t("selectExam")}
          </option>
          {catalogue.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("request")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
