import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AddMappingForm, CreateMappingSetForm, ExportForm } from "@/components/admin/dhis2-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { monthLabel, parseMonthParam } from "@/lib/reporting";
import { requireActorAndHospital } from "@/server/auth";
import { getDhis2ExportReadiness, getDhis2MappingAdmin } from "@/server/services";

/**
 * Phase 4B — DHIS2 configurable export / API-readiness. Aggregate-only. Manage mapping sets (org-unit /
 * data-element / category-option-combo PLACEHOLDERS — non-final), see per-period readiness (mapped vs
 * unmapped), export the manual CSV (Phase 2E format, preserved), or run a MOCK API export (no network).
 * No real DHIS2 credentials/codes. Hospital-scoped; RBAC server-authoritative. Synthetic data only.
 */
export default async function Dhis2Page() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "dhis2.mapping.manage")) redirect("/");

  const t = await getTranslations("dhis2");
  const { mappingSets } = await getDhis2MappingAdmin(actor, hospital);
  const month = monthLabel(new Date());
  const period = parseMonthParam(month)!;

  // Per-set readiness for the current period (validation BEFORE export).
  const readiness = new Map<string, { mapped: string[]; unmapped: string[]; ready: boolean; rowCount: number }>();
  for (const set of mappingSets) {
    readiness.set(set.id, await getDhis2ExportReadiness(actor, hospital, { mappingSetId: set.id, ...period }));
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("aggregateNotice")}</strong> · {t("mockApiNotice")}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("createSet")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMappingSetForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("setsFor", { period: month })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {mappingSets.length === 0 ? <p className="text-muted-foreground text-sm">{t("noSets")}</p> : null}
          {mappingSets.map((set) => {
            const r = readiness.get(set.id);
            return (
              <div key={set.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {set.code} — {set.name}{" "}
                    <span className="text-muted-foreground text-xs">(org-unit: {set.orgUnitPlaceholder || "—"})</span>
                  </span>
                  {r?.ready ? (
                    <Badge variant="secondary">{t("ready")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("unmappedCount", { count: r?.unmapped.length ?? 0 })}</Badge>
                  )}
                </div>
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">{t("mappings")}:</span>{" "}
                  {set.mappings.length === 0 ? (
                    <span className="text-muted-foreground">{t("none")}</span>
                  ) : (
                    set.mappings.map((m) => (
                      <span key={m.id} className="mr-2">
                        {m.localElement} → {m.dataElementPlaceholder}
                      </span>
                    ))
                  )}
                </div>
                {r && r.unmapped.length > 0 ? (
                  <p className="text-destructive mt-1 text-xs">
                    {t("unmapped")}: {r.unmapped.join(", ")}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3 border-t pt-3">
                  <AddMappingForm mappingSetId={set.id} />
                  <ExportForm mappingSetId={set.id} month={month} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
