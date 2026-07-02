import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { requireActorAndHospital } from "@/server/auth";
import { getDashboardSummary } from "@/server/services";

/**
 * Tableau de bord (06 §11): KPI tiles + recent activity from real actions, scoped to
 * the active hospital and the current day.
 */
export default async function DashboardPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const summary = await getDashboardSummary(actor, hospital);
  const t = await getTranslations("dashboard");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="text-right">
            <p className="text-foreground text-sm font-medium">{hospital.name}</p>
            <p className="text-muted-foreground text-xs">
              {hospital.region} · {hospital.code}
            </p>
          </div>
        }
      />
      <DashboardOverview summary={summary} />
    </>
  );
}
