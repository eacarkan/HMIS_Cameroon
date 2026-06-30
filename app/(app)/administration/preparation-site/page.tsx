import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ReadinessItemForm } from "@/components/admin/readiness-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getSiteReadiness } from "@/server/services";

/**
 * Phase 3C — Site readiness & deployment checklist. STATUS TRACKING ONLY (no infrastructure work).
 * Per-hospital checklist + readiness roll-up; managers update items (supplier-dependent items cannot
 * be self-claimed "ready"); directors / central viewer get read-only. Server-rendered via the
 * site-readiness service (per-hospital RBAC authoritative). Synthetic data only.
 */
export default async function SiteReadinessPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "readiness.view")) redirect("/");
  const canManage = can(rolesHere, "readiness.manage");

  const t = await getTranslations("readinessAdmin");
  const locale = await getLocale();
  const { items, summary } = await getSiteReadiness(actor, hospital);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-muted-foreground -mt-2 mb-4 text-xs">{t("boundaryNote")}</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("summaryFor", { hospital: hospital.name })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="tnum font-medium">
              {summary.ready}/{summary.applicable} · {summary.percentReady}%
            </span>
            {summary.siteReady ? (
              <Badge variant="secondary">{t("siteReady")}</Badge>
            ) : summary.blocked > 0 ? (
              <Badge variant="outline">{t("blockedCount", { count: summary.blocked })}</Badge>
            ) : null}
          </div>
          <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full" aria-hidden>
            <div className="bg-primary h-full rounded-full" style={{ width: `${summary.percentReady}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("checklist")}</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <div className="text-sm">
              {items.map((it) => (
                <ReadinessItemForm
                  key={it.key}
                  category={it.key}
                  label={locale === "en" ? it.labelEn : it.labelFr}
                  supplierDependent={it.supplierDependent}
                  status={it.status}
                  owner={it.owner}
                  evidenceNote={it.evidenceNote}
                  verifier={it.verifier}
                />
              ))}
            </div>
          ) : (
            <ul className="divide-y text-sm">
              {items.map((it) => (
                <li key={it.key} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {locale === "en" ? it.labelEn : it.labelFr}
                    {it.supplierDependent ? (
                      <span className="text-muted-foreground ml-2 text-xs">({t("supplierDependent")})</span>
                    ) : null}
                  </span>
                  <Badge variant={it.status === "ready" ? "secondary" : "outline"}>
                    {t(`statuses.${it.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
