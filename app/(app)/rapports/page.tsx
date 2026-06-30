import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { monthLabel, parseMonthParam } from "@/lib/reporting";
import { generateSnapshotAction } from "@/server/actions/central-actions";
import { requireActorAndHospital } from "@/server/auth";
import { getOperationalReport } from "@/server/services";

/** Phase 2E — hospital operational report (aggregate, no patient data) + DHIS2-aligned CSV export. */
export default async function OperationalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "report.operational.read")) redirect("/");

  const sp = await searchParams;
  const parsed = parseMonthParam(sp.month) ?? parseMonthParam(monthLabel(new Date()))!;
  const report = await getOperationalReport(actor, hospital, parsed);
  const t = await getTranslations("operationalReport");
  const tm = await getTranslations("paymentMethod");
  const canExport = can(actor.roles, "report.export");
  const tc = await getTranslations("central");

  const methodLabel = (m: string) =>
    ({ cash: tm("cash"), mobile_money: tm("mobile_money"), card: tm("card"), bank_transfer: tm("bank_transfer") })[m] ?? m;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <form action={generateSnapshotAction}>
            <Button type="submit" variant="secondary" size="sm">
              {tc("generateSnapshot")}
            </Button>
          </form>
        }
      />

      <div className="border-primary/30 bg-primary/5 mb-6 rounded-md border p-3 text-sm">
        {t("privacyNotice")}
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex items-end gap-2">
          <div className="grid gap-1">
            <label htmlFor="month" className="text-muted-foreground text-xs">
              {t("period")}
            </label>
            <input
              id="month"
              name="month"
              type="month"
              defaultValue={report.periodLabel}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            {t("apply")}
          </Button>
        </form>
        {canExport ? (
          <a href={`/rapports/export?month=${report.periodLabel}`}>
            <Button size="sm">{t("exportCsv")}</Button>
          </a>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("kpiPeriod")} value={report.periodLabel} />
        <Kpi label={t("kpiConsultations")} value={report.consultationCount} />
        <Kpi label={t("kpiDiagnoses")} value={report.diagnosisCount} />
        <Kpi label={t("kpiRevenue")} value={formatFcfa(report.revenueTotal)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("ageGenderTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs">
              <tr>
                <th className="py-2 pr-4 font-medium">{t("ageBand")}</th>
                <th className="py-2 pr-4 text-right font-medium">{t("male")}</th>
                <th className="py-2 pr-4 text-right font-medium">{t("female")}</th>
                <th className="py-2 pr-4 text-right font-medium">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {report.ageGender.map((r) => (
                <tr key={r.band} className="border-b last:border-0">
                  <td className="py-2 pr-4">{r.band}</td>
                  <td className="tnum py-2 pr-4 text-right">{r.M}</td>
                  <td className="tnum py-2 pr-4 text-right">{r.F}</td>
                  <td className="tnum py-2 pr-4 text-right font-medium">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("diagnosesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.diagnoses.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("diagnosesEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("code")}</th>
                  <th className="py-2 pr-4 font-medium">{t("label")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("count")}</th>
                </tr>
              </thead>
              <tbody>
                {report.diagnoses.map((d) => (
                  <tr key={d.code} className="border-b last:border-0">
                    <td className="tnum py-2 pr-4">{d.code}</td>
                    <td className="py-2 pr-4">{d.label}</td>
                    <td className="tnum py-2 pr-4 text-right font-medium">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("revenueTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.revenueByMethod.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("revenueEmpty")}</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {report.revenueByMethod.map((r) => (
                    <tr key={r.method} className="border-b last:border-0">
                      <td className="py-2 pr-4">{methodLabel(r.method)}</td>
                      <td className="tnum py-2 pr-4 text-right font-medium">{formatFcfa(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {report.pharmacy ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("pharmacyTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{t("pharmacyMeds")}: {report.pharmacy.medicationsTracked}</p>
              <p>{t("pharmacyLow")}: {report.pharmacy.low}</p>
              <p>{t("pharmacyExpiring")}: {report.pharmacy.expiring}</p>
              <p>{t("pharmacyDispensed")}: {report.pharmacy.dispensedUnits30d}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.exportHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("histPeriod")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("histRows")}</th>
                  <th className="py-2 pr-4 font-medium">{t("histBy")}</th>
                  <th className="py-2 pr-4 font-medium">{t("histWhen")}</th>
                </tr>
              </thead>
              <tbody>
                {report.exportHistory.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="tnum py-2 pr-4">{e.periodLabel}</td>
                    <td className="tnum py-2 pr-4 text-right">{e.rowCount}</td>
                    <td className="py-2 pr-4">{e.exportedBy.displayName}</td>
                    <td className="py-2 pr-4">{formatDateTimeFr(new Date(e.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="tnum mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
