import { Check, Minus } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  ApplyTemplateForm,
  RecomputeButton,
  OverrideSettingForm,
} from "@/components/admin/configuration-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryStatus, CompletenessResult } from "@/lib/configuration-completeness";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import {
  getConfigurationCompleteness,
  listAccessibleHospitalCompleteness,
  listTemplates,
  listTemplateApplications,
} from "@/server/services";

/**
 * Phase 3A — Multi-hospital configuration foundation. Per-hospital completeness dashboard,
 * Bertoua/Ebolowa comparison (only across the actor's own hospitals — no cross-hospital leak),
 * and template apply (guarded, scoped, audited). Server-rendered via the hospital-configuration
 * service (server-side RBAC + scoping authoritative). Synthetic data only — config, no patient data.
 */
export default async function ConfigurationPage() {
  const { actor, hospital } = await requireActorAndHospital();
  // Authoritative gating uses the roles held AT the active hospital — never the cross-hospital
  // union — so a multi-site member cannot borrow another hospital's privileges here.
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "config.view")) redirect("/");
  const canManageInstance = can(rolesHere, "config.instance.manage");

  const t = await getTranslations("configAdmin");
  const locale = await getLocale();
  const labelOf = (c: { labelFr: string; labelEn: string }) =>
    locale === "en" ? c.labelEn : c.labelFr;

  const [completeness, accessible, templates, applications] = await Promise.all([
    getConfigurationCompleteness(actor, hospital),
    listAccessibleHospitalCompleteness(actor),
    listTemplates(actor, hospital),
    listTemplateApplications(actor, hospital),
  ]);

  const comparison = accessible.filter((h) => h.hospitalId !== hospital.hospitalId);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<RecomputeButton />} />

      <p className="text-muted-foreground -mt-2 mb-4 text-xs">{t("boundaryNote")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("completenessFor", { hospital: hospital.name })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CompletenessBar result={completeness} readyLabel={t("ready")} percentLabel={t("percentConfigured")} />
            <ul className="mt-4 grid gap-1.5 text-sm">
              {completeness.categories.map((c) => (
                <CategoryRow key={c.key} category={c} label={labelOf(c)} doneLabel={t("configured")} todoLabel={t("notConfigured")} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("comparisonTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {comparison.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("comparisonNone")}</p>
            ) : (
              <>
                <p className="text-muted-foreground -mt-1 mb-3 text-xs">{t("comparisonHint")}</p>
                <ul className="divide-y text-sm">
                  <li className="flex items-center justify-between gap-3 py-2 font-medium">
                    <span>{hospital.name}</span>
                    <span className="tnum">{completeness.percent}%</span>
                  </li>
                  {comparison.map((h) => (
                    <li key={h.hospitalId} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {h.name}{" "}
                        <span className="text-muted-foreground text-xs">({h.code})</span>
                      </span>
                      <span className="tnum">{h.completeness.percent}%</span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-3 text-xs">{t("divergenceNote")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("templatesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("templatesNone")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {templates.map((tpl) => (
                  <li key={tpl.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium">{tpl.name}</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        ({tpl.code} v{tpl.version})
                      </span>
                    </span>
                    {tpl.sourceHospitalId ? <Badge variant="secondary">{t("reference")}</Badge> : null}
                  </li>
                ))}
              </ul>
            )}

            {canManageInstance ? (
              <>
                <div className="mt-4">
                  <p className="text-sm font-medium">{t("applyTitle")}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("applyHint", { hospital: hospital.name })}
                  </p>
                  <ApplyTemplateForm
                    templates={templates.map((tpl) => ({
                      id: tpl.id,
                      code: tpl.code,
                      name: tpl.name,
                      version: tpl.version,
                    }))}
                  />
                </div>
                <div className="mt-5 border-t pt-4">
                  <p className="text-sm font-medium">{t("overrideTitle")}</p>
                  <p className="text-muted-foreground text-xs">{t("overrideHint")}</p>
                  <OverrideSettingForm />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-3 text-xs">{t("readOnlyNotice")}</p>
            )}

            {applications.length > 0 ? (
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-medium">{t("historyTitle")}</p>
                <ul className="mt-2 divide-y text-sm">
                  {applications.map((a) => (
                    <li key={a.id} className="py-2">
                      <span className="text-muted-foreground">{a.summary}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CompletenessBar({
  result,
  readyLabel,
  percentLabel,
}: {
  result: CompletenessResult;
  readyLabel: string;
  percentLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium tnum">
          {result.configuredCount}/{result.total} · {result.percent}%
        </span>
        {result.ready ? <Badge variant="secondary">{readyLabel}</Badge> : null}
      </div>
      <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full" aria-hidden>
        <div className="bg-primary h-full rounded-full" style={{ width: `${result.percent}%` }} />
      </div>
      <p className="sr-only">{percentLabel}: {result.percent}%</p>
    </div>
  );
}

function CategoryRow({
  category,
  label,
  doneLabel,
  todoLabel,
}: {
  category: CategoryStatus;
  label: string;
  doneLabel: string;
  todoLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        {category.configured ? (
          <Check className="size-4 text-emerald-600" aria-hidden />
        ) : (
          <Minus className="text-muted-foreground size-4" aria-hidden />
        )}
        {label}
      </span>
      <span className="sr-only">{category.configured ? doneLabel : todoLabel}</span>
    </li>
  );
}
