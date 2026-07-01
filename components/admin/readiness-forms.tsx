"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { READINESS_STATUSES, type ReadinessStatus } from "@/lib/site-readiness";
import { setReadinessItemAction } from "@/server/actions/readiness-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * Phase 3C — per-item site-readiness update form (client). Thin wrapper over the server action →
 * site-readiness service (server-side RBAC + scoping + audit + supplier-dependent READY gate).
 * Rendered only for managers; the server remains authoritative.
 */
const initial: ActionState = {};

export function ReadinessItemForm({
  category,
  label,
  supplierDependent,
  status,
  owner,
  evidenceNote,
  verifier,
}: {
  category: string;
  label: string;
  supplierDependent: boolean;
  status: ReadinessStatus;
  owner: string | null;
  evidenceNote: string | null;
  verifier: string | null;
}) {
  const t = useTranslations("readinessAdmin");
  const [state, action, pending] = useActionState(setReadinessItemAction, initial);
  return (
    <form action={action} className="grid gap-2 border-t py-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="category" value={category} />
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {supplierDependent ? (
            <span className="text-muted-foreground text-xs">({t("supplierDependent")})</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs">
            {t("status")}
            <select
              name="status"
              defaultValue={status}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            >
              {READINESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            {t("owner")}
            <Input name="owner" className="h-9 w-40" defaultValue={owner ?? ""} />
          </label>
          <label className="grid gap-1 text-xs">
            {t("verifier")}
            <Input name="verifier" className="h-9 w-40" defaultValue={verifier ?? ""} />
          </label>
          <label className="grid gap-1 text-xs">
            {t("evidenceNote")}
            <Input name="evidenceNote" className="h-9 w-56" defaultValue={evidenceNote ?? ""} />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {t("save")}
          </Button>
        </div>
        {state.error ? (
          <p role="alert" className="text-destructive text-xs">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="text-xs text-emerald-700">
            {t("saved")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
