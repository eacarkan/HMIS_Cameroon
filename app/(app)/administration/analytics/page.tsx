import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreateDefinitionForm,
  ExportRunActions,
  RunForm,
  ToggleDefinitionForm,
} from "@/components/admin/analytics-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getAnalyticsAdmin } from "@/server/services";

/**
 * Phase 4F — advanced reporting / analytics foundation. Configurable saved report definitions +
 * on-demand / scheduled-PLACEHOLDER runs + an export registry. AGGREGATE-ONLY: reports are built from
 * the Phase 2E aggregate operational report (no nominative field). No AI/ML. No patient-level central
 * disclosure — hospital-scoped. RBAC server-authoritative. Synthetic data only.
 */
export default async function AnalyticsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "analytics.report.view") && !can(rolesHere, "analytics.report.manage")) redirect("/");

  const t = await getTranslations("analytics");
  const { definitions, runs, exports, canManage } = await getAnalyticsAdmin(actor, hospital);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("aggregateNotice")}</strong>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">{t("definitions")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {canManage ? <CreateDefinitionForm /> : null}
          {definitions.length === 0 ? <p className="text-muted-foreground text-sm">{t("noDefinitions")}</p> : null}
          {definitions.map((d) => (
            <div key={d.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {d.code} — {d.name}{" "}
                  <Badge variant="outline">{t(`kinds.${d.kind}`)}</Badge>{" "}
                  {d.isActive ? null : <Badge variant="secondary">{t("inactive")}</Badge>}
                </span>
                {canManage ? <ToggleDefinitionForm id={d.id} isActive={d.isActive} /> : null}
              </div>
              {d.schedulePlaceholder ? (
                <p className="text-muted-foreground mt-1 text-xs">{t("scheduleNote", { cron: d.schedulePlaceholder })}</p>
              ) : null}
              {canManage && d.isActive ? <div className="mt-2 border-t pt-2"><RunForm definitionId={d.id} /></div> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">{t("runs")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {runs.length === 0 ? <p className="text-muted-foreground text-sm">{t("noRuns")}</p> : null}
          {runs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>
                <span className="font-medium">{r.definition.code}</span>{" "}
                <span className="text-muted-foreground text-xs">{r.periodLabel} · {t(`triggers.${r.trigger}`)} · {r.rowCount} {t("rows")}</span>{" "}
                <Badge variant={r.status === "FAILED" ? "destructive" : r.status === "COMPLETED" ? "secondary" : "outline"}>
                  {t(`runStatuses.${r.status}`)}
                </Badge>
              </span>
              {canManage && r.status === "COMPLETED" ? <ExportRunActions runId={r.id} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("exportRegistry")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {exports.length === 0 ? <p className="text-muted-foreground text-sm">{t("noExports")}</p> : null}
          {exports.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span><Badge variant="outline">{e.format}</Badge> {e.rowCount} {t("rows")}</span>
              <span className="text-muted-foreground text-xs">{e.createdAt.toISOString().slice(0, 10)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
