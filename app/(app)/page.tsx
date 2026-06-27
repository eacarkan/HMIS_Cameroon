import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

/**
 * Tableau de bord — the empty dashboard route (Step 1-2). Real KPI values arrive
 * at Step 11; for now it shows the page-header pattern and placeholder tiles.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <DashboardOverview />
    </>
  );
}
