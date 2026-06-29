import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import type { DashboardSummary } from "@/server/services";

/**
 * Dashboard overview (06 §11; Phase 1A Batch 5) — role-specific KPI sections plus, for
 * oversight roles (management), a recent-activity panel. All read-only, hospital-scoped.
 */
export async function DashboardOverview({
  summary,
}: {
  summary: DashboardSummary;
}) {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <DashboardKpis summary={summary} />

      {summary.sections.management ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("kpi.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center">
                <Activity className="text-muted-foreground size-6" aria-hidden />
                <p className="text-muted-foreground max-w-md text-sm">{t("placeholder")}</p>
              </div>
            ) : (
              <ul className="divide-y text-sm">
                {summary.recent.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.summary}</span>
                      {entry.actorName ? (
                        <span className="text-muted-foreground block text-xs">
                          {entry.actorName}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground tnum shrink-0 text-xs">
                      {formatDateTimeFr(new Date(entry.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
