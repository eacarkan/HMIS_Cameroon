import { getTranslations } from "next-intl/server";

import { ExecutiveHeader } from "@/components/dashboard/executive-header";
import { SyntheticDataNotice } from "@/components/dashboard/synthetic-data-notice";
import { resolveWorkspaceProfile } from "@/lib/dashboard-workspace";
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
  // S4.2B — first screen composed per role workspace (figures stay capability-gated).
  const profile = resolveWorkspaceProfile(roles);

  return (
    <>
      <ExecutiveHeader
        hospital={hospital}
        userName={actor.displayName}
        roleLabels={roleLabels}
        roles={roles}
        summary={summary}
        extras={extras}
        profile={profile}
      />
      {/* S4.2 scope 4 — synthetic-data freshness metadata (period · last activity · no
          integrations), so stakeholders know exactly what the figures represent. */}
      <div className="-mt-3 mb-5">
        <SyntheticDataNotice lastActivityAt={summary.recent[0]?.createdAt ?? null} />
      </div>
      <DashboardOverview summary={summary} extras={extras} roles={roles} profile={profile} />
    </>
  );
}
