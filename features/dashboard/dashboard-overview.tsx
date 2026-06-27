import { Activity, Banknote, DoorOpen, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Dashboard overview (06 §11) — a small set of meaningful KPI tiles plus a recent
 * activity panel. FOUNDATIONS: the tiles are PLACEHOLDERS with no real data; they
 * light up from real actions once the golden path is built (Step 11). The values
 * intentionally show "—", not 0, to avoid implying a real measurement.
 */
const KPI_TILES = [
  { key: "patientsToday", icon: Users },
  { key: "openEncounters", icon: DoorOpen },
  { key: "collectionsToday", icon: Banknote },
] as const;

export async function DashboardOverview() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPI_TILES.map(({ key, icon: Icon }) => (
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
              <div className="tnum text-foreground/35 text-3xl font-semibold tracking-tight">
                —
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("noData")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("kpi.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center">
            <Activity className="text-muted-foreground size-6" aria-hidden />
            <p className="text-muted-foreground max-w-md text-sm">
              {t("placeholder")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
