"use client";

import { Info, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Mandatory public disclaimers (Phase 6). Shown on the public SantéGrid pages so a
 * visitor can never mistake the demonstration for production or for an official
 * government website:
 *   1. synthetic-demonstration notice (no real patient data);
 *   2. "not an official government website" notice (not Gate 7, not production).
 *
 * Presentational + i18n-driven (`publicSite.disclaimer.*`) so it renders under the
 * next-intl provider and is unit-testable with `renderWithIntl`.
 */
export function PublicDisclaimers() {
  const t = useTranslations("publicSite.disclaimer");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t("syntheticTitle")}</p>
          <p className="text-amber-800">{t("syntheticBody")}</p>
        </div>
      </div>
      <div className="border-primary/30 bg-primary/5 flex gap-3 rounded-lg border p-4 text-sm">
        <ShieldAlert className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-1">
          <p className="text-foreground font-medium">{t("notGovernmentTitle")}</p>
          <p className="text-muted-foreground">{t("notGovernmentBody")}</p>
        </div>
      </div>
    </div>
  );
}
