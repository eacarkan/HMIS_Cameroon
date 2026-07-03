import { DatabaseZap } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { formatDateFr } from "@/lib/dates";

/**
 * Synthetic-data freshness line (Phase 6.3 S4.2 — scope 4). A discreet, professional
 * metadata strip telling stakeholders exactly what the figures represent: synthetic
 * review data, its period, the last simulated activity, and that nothing is connected.
 * Used on the executive dashboard and /central. Server component; no data access —
 * the caller passes the best timestamp it already has (or null).
 */
export async function SyntheticDataNotice({
  lastActivityAt,
}: {
  lastActivityAt: Date | null;
}) {
  const t = await getTranslations("dashboard.freshness");
  const parts = [
    t("synthetic"),
    t("period"),
    lastActivityAt
      ? t("lastActivity", { date: formatDateFr(new Date(lastActivityAt)) })
      : t("recentActivity"),
    t("noIntegrations"),
  ];
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
      <DatabaseZap className="size-3.5 shrink-0 opacity-70" aria-hidden />
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-2">
          {i > 0 ? (
            <span className="text-muted-foreground/50" aria-hidden>
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </p>
  );
}
