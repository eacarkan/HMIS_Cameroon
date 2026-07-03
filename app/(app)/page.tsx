import { getTranslations } from "next-intl/server";

import { ExecutiveHeader } from "@/components/dashboard/executive-header";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { requireActorAndHospital } from "@/server/auth";
import { getDashboardExtras, getDashboardSummary } from "@/server/services";

/**
 * Tableau de bord (06 §11; executive layout 6.3 S4): teal executive band (hospital
 * identity, role, review badge, hero KPIs) over role-gated ledgers, SVG operation
 * panels and the workspace/guided-demo rail. Real actions, scoped to the active
 * hospital; synthetic demonstration data only.
 */
export default async function DashboardPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const [summary, extras] = await Promise.all([
    getDashboardSummary(actor, hospital),
    getDashboardExtras(actor, hospital),
  ]);
  const tRoles = await getTranslations("roles");
  const roles = actor.rolesByHospital[hospital.hospitalId] ?? [];
  const roleLabels = roles.map((code) => (tRoles.has(code) ? tRoles(code) : code));

  return (
    <>
      <ExecutiveHeader
        hospital={hospital}
        userName={actor.displayName}
        roleLabels={roleLabels}
        summary={summary}
      />
      <DashboardOverview summary={summary} extras={extras} roles={roles} />
    </>
  );
}
