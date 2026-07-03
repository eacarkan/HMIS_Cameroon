import { Activity } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import {
  ActivityTrendPanel,
  BillingBreakdownPanel,
  CareOperationsPanel,
} from "@/components/dashboard/dashboard-panels";
import { GuidedDemoRail, QuickAccessCards } from "@/components/dashboard/dashboard-rail";
import { PatientJourneyFlow } from "@/components/public/patient-journey-flow";
import { auditActionLabel } from "@/lib/constants";
import { formatDateTimeFr } from "@/lib/dates";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Dashboard overview (06 §11; Phase 1A Batch 5; executive layout 6.3 S4 — hybrid
 * direction). Left: role-gated KPI ledgers + SVG operation panels + the compact patient
 * journey. Right rail: recent activity (oversight), guided demo, role-aware workspaces.
 * All read-only, hospital-scoped, synthetic-only; every optional block is capability-gated
 * so the page renders correctly for every role and on an empty database.
 */
export async function DashboardOverview({
  summary,
  extras,
  roles,
}: {
  summary: DashboardSummary;
  extras: DashboardExtras;
  roles: string[];
}) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Operations column */}
      <div className="min-w-0 space-y-5">
        <DashboardKpis summary={summary} hideActivity />
        <ActivityTrendPanel extras={extras} />
        {summary.sections.billing ? <BillingBreakdownPanel summary={summary} /> : null}
        <CareOperationsPanel extras={extras} />

        {/* Compact patient journey (bilingual landing.journey keys, reused from S2) */}
        <section className="bg-card rounded-xl border px-4 py-4 shadow-(--shadow-card)">
          <h2 className="mb-4 text-[13px] font-bold tracking-tight">{t("journeyTitle")}</h2>
          <PatientJourneyFlow />
        </section>
      </div>

      {/* Rail */}
      <div className="min-w-0 space-y-5">
        {summary.sections.management ? (
          <section
            aria-labelledby="recent-activity-title"
            className="bg-card rounded-xl border shadow-(--shadow-card)"
          >
            <div className="border-b px-4 py-3">
              <h2 id="recent-activity-title" className="text-[13px] font-bold tracking-tight">
                {t("kpi.recentActivity")}
              </h2>
            </div>
            <div className="px-4 py-2">
              {summary.recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
                  <Activity className="text-muted-foreground/60 size-5" aria-hidden />
                  <p className="text-muted-foreground max-w-md text-xs">{t("placeholder")}</p>
                </div>
              ) : (
                <ul className="divide-y text-sm">
                  {summary.recent.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {auditActionLabel(entry.action, locale)}
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
            </div>
          </section>
        ) : null}

        <QuickAccessCards roles={roles} />
        <GuidedDemoRail roles={roles} />
      </div>
    </div>
  );
}
