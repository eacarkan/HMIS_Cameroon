import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getCentralOversight } from "@/server/services";

/**
 * Phase 3D — Central aggregate oversight (read-only, AGGREGATE-ONLY). Reads ONLY per-hospital
 * snapshots (never operational patient-level tables). No drilldown to any patient. Gated on the
 * GLOBAL `central.aggregate.view`. Synthetic data only.
 */
export default async function CentralOversightPage() {
  // requireActorAndHospital gives a session; central.aggregate.view is a GLOBAL capability.
  const { actor } = await requireActorAndHospital();
  if (!can(actor.roles, "central.aggregate.view")) redirect("/");

  const t = await getTranslations("central");
  const { hospitals } = await getCentralOversight(actor);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-muted-foreground -mt-2 mb-4 text-xs">{t("noPatientNotice")}</p>

      {hospitals.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noData")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {hospitals.map((h) => (
            <Card key={h.hospitalId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>
                    {h.name} <span className="text-muted-foreground text-xs">({h.code})</span>
                  </span>
                  <Badge variant="secondary">{h.indicators.periodLabel}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Stat label={t("consultations")} value={h.indicators.consultationCount} />
                  <Stat label={t("patients")} value={h.indicators.patientCount} />
                  <Stat label={t("revenue")} value={formatFcfa(h.indicators.revenueTotalFcfa)} />
                  <Stat label={t("queue")} value={h.indicators.queueTicketCount} />
                  <Stat label={t("admissions")} value={h.indicators.admissionCount} />
                  <Stat label={t("diagnostics")} value={h.indicators.diagnosticOrderCount} />
                  <Stat label={t("emergencyDebt")} value={formatFcfa(h.indicators.emergencyDebtOutstandingFcfa)} />
                  {h.indicators.pharmacy ? (
                    <Stat
                      label={t("pharmacyAlerts")}
                      value={`${h.indicators.pharmacy.lowStock} / ${h.indicators.pharmacy.expiringLots}`}
                    />
                  ) : null}
                </dl>
                {h.indicators.topDiagnoses.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-muted-foreground text-xs">{t("topDiagnoses")}</p>
                    <ul className="mt-1 text-xs">
                      {h.indicators.topDiagnoses.slice(0, 5).map((d) => (
                        <li key={d.code} className="flex justify-between gap-2">
                          <span>
                            {d.code} — {d.label}
                          </span>
                          <span className="tnum">{d.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum text-right font-medium">{value}</dd>
    </>
  );
}
