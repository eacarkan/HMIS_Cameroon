import { Activity, Banknote, DoorOpen, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import type { DashboardSummary } from "@/server/services";

/**
 * Dashboard overview (06 §11) — a few meaningful KPI tiles plus a recent-activity
 * panel, all from real actions scoped to the active hospital and today.
 */
export async function DashboardOverview({
  summary,
}: {
  summary: DashboardSummary;
}) {
  const t = await getTranslations("dashboard");

  const tiles = [
    {
      key: "patientsToday",
      icon: Users,
      value: String(summary.patientsToday),
    },
    {
      key: "openEncounters",
      icon: DoorOpen,
      value: String(summary.openEncounters),
    },
    {
      key: "collectionsToday",
      icon: Banknote,
      value: formatFcfa(summary.collectionsToday),
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ key, icon: Icon, value }) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {t(`kpi.${key}`)}
              </CardTitle>
              <CardAction>
                <Icon className="text-muted-foreground size-4" aria-hidden />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="tnum text-foreground text-3xl font-semibold tracking-tight">
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("kpi.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center">
              <Activity className="text-muted-foreground size-6" aria-hidden />
              <p className="text-muted-foreground max-w-md text-sm">
                {t("placeholder")}
              </p>
            </div>
          ) : (
            <ul className="divide-y text-sm">
              {summary.recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {entry.summary}
                    </span>
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
    </div>
  );
}
