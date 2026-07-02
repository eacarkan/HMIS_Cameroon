"use client";

import { useTranslations } from "next-intl";

import { PROTOTYPE_LABEL } from "@/lib/constants";

/**
 * Discreet synthetic-review indicator (Phase 6.2). A slim, professional band shown at the
 * top of every screen so the environment can never be mistaken for real operational data —
 * without the alarming "prototype / non-production" wording. The visible label is the
 * neutral "Environnement de revue — données synthétiques" (localized); the fuller note is a
 * hover tooltip. The formal archival marker (`PROTOTYPE_LABEL`) is retained for screen
 * readers + printed documents (which keep it in full) so the safeguard stays intact.
 */
export function PrototypeBanner() {
  const t = useTranslations("app");
  return (
    <div
      role="note"
      title={t("reviewEnvironmentNote")}
      className="text-muted-foreground bg-muted/50 flex items-center justify-center gap-2 border-b px-4 py-1 text-center text-[11px] font-medium tracking-wide"
    >
      <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" aria-hidden />
      <span>{t("reviewEnvironmentBadge")}</span>
      {/* Formal marker retained (screen readers + guardrail); not visually dominant. */}
      <span className="sr-only">{PROTOTYPE_LABEL}</span>
    </div>
  );
}
