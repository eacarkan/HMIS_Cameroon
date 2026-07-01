"use client";

import { useTranslations } from "next-intl";

import { formatDateTimeFr } from "@/lib/dates";
import type { TimelineEvent } from "@/lib/patient-timeline";

/**
 * Read-only patient timeline (Phase 1A Batch 1B). Presentational: renders the chronological
 * events composed server-side from existing records. No mutation, no new persistence.
 */
export function PatientTimeline({ events }: { events: TimelineEvent[] }) {
  const t = useTranslations("timeline");
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }
  return (
    <ol className="space-y-2.5">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex items-baseline gap-3 text-sm">
          <span className="text-muted-foreground tnum w-32 shrink-0 text-xs">
            {formatDateTimeFr(new Date(e.at))}
          </span>
          <span className="font-medium">{t(`type.${e.type}`)}</span>
          {e.ref ? <span className="text-muted-foreground tnum text-xs">{e.ref}</span> : null}
        </li>
      ))}
    </ol>
  );
}
