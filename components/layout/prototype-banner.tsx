"use client";

import { useTranslations } from "next-intl";

import { PROTOTYPE_LABEL } from "@/lib/constants";

/**
 * Discreet synthetic-review indicator (Phase 6.2; 6.5B). A slim, professional band at the
 * top of every screen so the environment can never be mistaken for real operational data.
 * The visible label is the neutral, localized "Environnement de revue — données
 * synthétiques"; the fuller note is a hover tooltip.
 *
 * `archivalMarker` (default true) appends the formal `PROTOTYPE_LABEL` for screen readers.
 * On PUBLIC visitor-facing pages it is set to FALSE (6.5B mentor policy): sr-only text is
 * still public-facing, so it must follow the same public wording rule — accessibility users
 * hear the clean review-environment badge, never the internal "non destiné à la production"
 * wording. The marker is retained on authenticated/technical surfaces (and printed docs),
 * so the archival safeguard + `check:privacy` stay intact.
 */
export function PrototypeBanner({
  archivalMarker = true,
}: {
  archivalMarker?: boolean;
} = {}) {
  const t = useTranslations("app");
  return (
    <div
      role="note"
      title={t("reviewEnvironmentNote")}
      className="text-muted-foreground bg-muted/50 flex items-center justify-center gap-2 border-b px-4 py-1 text-center text-[11px] font-medium tracking-wide"
    >
      <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" aria-hidden />
      <span>{t("reviewEnvironmentBadge")}</span>
      {/* Formal archival marker — authenticated/technical + print only; omitted on public
          pages where the accessible text is the clean review-environment badge above. */}
      {archivalMarker ? <span className="sr-only">{PROTOTYPE_LABEL}</span> : null}
    </div>
  );
}
