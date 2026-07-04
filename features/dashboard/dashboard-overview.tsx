import { Activity, ChevronRight, Globe2 } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CommandStrip } from "@/components/dashboard/command-strip";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import {
  ActivityTrendPanel,
  BillingBreakdownPanel,
  CareOperationsPanel,
  ClinicalTrendPanel,
  DiagnosticsTrendPanel,
  PharmacyWorklistPanel,
} from "@/components/dashboard/dashboard-panels";
import {
  GuidedDemoRail,
  QuickAccessCards,
  TraceabilityCard,
} from "@/components/dashboard/dashboard-rail";
import { JourneyOperational } from "@/components/dashboard/journey-operational";
import { auditActionLabel } from "@/lib/constants";
import type { WorkspaceProfile } from "@/lib/dashboard-workspace";
import { formatDateTimeFr } from "@/lib/dates";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Dashboard overview (06 §11; executive layout S4; operations command S4.2; role
 * workspaces S4.2B). Composition is selected per workspace profile so the first
 * screen answers "what work should this user handle now?":
 *  - admin/operations — the accepted command-center layout (strip, hospital trend);
 *  - clinical — clinical trend leads; no hospital-wide command strip;
 *  - cashier — collections-by-method leads;
 *  - pharmacy — pharmacy worklist leads (no fake chart);
 *  - diagnostics — diagnostic-requests trend leads.
 * All read-only, hospital-scoped, synthetic-only; every figure stays capability-gated
 * so no profile can reveal a number its role may not read.
 */
export async function DashboardOverview({
  summary,
  extras,
  roles,
  profile,
}: {
  summary: DashboardSummary;
  extras: DashboardExtras;
  roles: string[];
  profile: WorkspaceProfile;
}) {
  const t = await getTranslations("dashboard");
  const tCentral = await getTranslations("central");
  const locale = await getLocale();
  const isCommandCenter = profile === "admin" || profile === "operations";
  const isCentral = profile === "central";

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Operations column — lead panels differ per workspace profile. */}
      <div className="min-w-0 space-y-5">
        {/* Central supervisor — aggregate-only: NO patient/operational widgets here;
            the workspace points to multi-site oversight. */}
        {isCentral ? (
          <section className="bg-card rounded-xl border shadow-(--shadow-card)">
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
                <Globe2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold tracking-tight">{tCentral("title")}</h2>
                <p className="text-muted-foreground text-[11px]">{tCentral("subtitle")}</p>
              </div>
            </div>
            <div className="px-4 py-4">
              <p className="text-muted-foreground mb-3 max-w-prose text-sm">
                {tCentral("noPatientNotice")}
              </p>
              <Link
                href="/central"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors"
              >
                {tCentral("title")}
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </section>
        ) : null}

        {isCommandCenter ? (
          <CommandStrip summary={summary} extras={extras} roles={roles} />
        ) : null}

        {/* Role lead panel (the first thing under the hero for operational roles). */}
        {profile === "pharmacy" ? <PharmacyWorklistPanel extras={extras} /> : null}
        {profile === "diagnostics" ? <DiagnosticsTrendPanel extras={extras} /> : null}
        {profile === "clinical" ? <ClinicalTrendPanel extras={extras} /> : null}
        {profile === "cashier" && summary.sections.billing ? (
          <BillingBreakdownPanel summary={summary} />
        ) : null}

        {/* Patient-derived operational widgets are hidden from the aggregate-only supervisor. */}
        {isCentral ? null : (
          <>
            <JourneyOperational summary={summary} extras={extras} roles={roles} />
            <DashboardKpis summary={summary} hideActivity />
          </>
        )}

        {/* Hospital-wide visuals stay on the command-center profiles only. */}
        {isCommandCenter ? <ActivityTrendPanel extras={extras} /> : null}
        {isCommandCenter && summary.sections.billing ? (
          <BillingBreakdownPanel summary={summary} />
        ) : null}
        {isCommandCenter || profile === "clinical" ? (
          <CareOperationsPanel extras={extras} />
        ) : null}
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
        <TraceabilityCard roles={roles} />
        <GuidedDemoRail roles={roles} />
      </div>
    </div>
  );
}
