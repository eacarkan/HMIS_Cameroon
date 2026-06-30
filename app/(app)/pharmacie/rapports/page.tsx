import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPharmacyReport } from "@/server/services";

/** Phase 2D-8 — read-only pharmacy report: stock levels, low stock, expiring lots, dispensing volume. */
export default async function PharmacyReportPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "stock.read")) redirect("/");

  const report = await getPharmacyReport(actor, hospital);
  const t = await getTranslations("pharmacyReport");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { days: report.windowDays })}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("kpiMedications")} value={report.stockLevels.length} />
        <Kpi label={t("kpiLow")} value={report.lowStock.length} alert={report.lowStock.length > 0} />
        <Kpi label={t("kpiExpiring")} value={report.expiringLots.length} alert={report.expiringLots.length > 0} />
        <Kpi label={t("kpiDispensed")} value={`${report.dispensing.totalUnits} (${report.dispensing.recordCount})`} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("lowTitle", { threshold: report.lowStockThreshold })}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.lowStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("lowEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("medication")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("available")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("onHand")}</th>
                </tr>
              </thead>
              <tbody>
                {report.lowStock.map((r) => (
                  <tr key={r.medicationId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {r.nameFr} <span className="text-muted-foreground text-xs">({r.code})</span>
                    </td>
                    <td className="tnum py-2 pr-4 text-right font-medium">
                      {r.available} {r.unit}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{r.totalOnHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("expiringTitle", { days: report.expirySoonDays })}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.expiringLots.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("expiringEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("medication")}</th>
                  <th className="py-2 pr-4 font-medium">{t("batch")}</th>
                  <th className="py-2 pr-4 font-medium">{t("expiry")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("onHand")}</th>
                  <th className="py-2 pr-4 font-medium">{t("state")}</th>
                </tr>
              </thead>
              <tbody>
                {report.expiringLots.map((b) => (
                  <tr key={b.batchId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{b.medicationNameFr}</td>
                    <td className="tnum py-2 pr-4">{b.batchNumber}</td>
                    <td className="py-2 pr-4">{formatDateFr(b.expiryDate)}</td>
                    <td className="tnum py-2 pr-4 text-right">
                      {b.quantityOnHand} {b.unit}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant={b.status === "expired" ? "destructive" : "secondary"}>
                        {b.status === "expired" ? t("expired") : t("expiringSoon")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("dispensingTitle", { days: report.windowDays })}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.dispensing.byMedication.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("dispensingEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("medication")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("units")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("lines")}</th>
                </tr>
              </thead>
              <tbody>
                {report.dispensing.byMedication.map((r) => (
                  <tr key={r.medicationId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.nameFr}</td>
                    <td className="tnum py-2 pr-4 text-right font-medium">
                      {r.units} {r.unit}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{r.lineCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("levelsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.stockLevels.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("levelsEmpty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("medication")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("onHand")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("reserved")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("available")}</th>
                  <th className="py-2 pr-4 font-medium">{t("earliestExpiry")}</th>
                </tr>
              </thead>
              <tbody>
                {report.stockLevels.map((r) => (
                  <tr key={r.medicationId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {r.nameFr} <span className="text-muted-foreground text-xs">({r.code})</span>
                      {r.low ? (
                        <Badge variant="secondary" className="ml-2">
                          {t("low")}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">
                      {r.totalOnHand} {r.unit}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{r.totalReserved}</td>
                    <td className="tnum py-2 pr-4 text-right font-medium">{r.available}</td>
                    <td className="py-2 pr-4">
                      {r.earliestExpiry ? formatDateFr(r.earliestExpiry) : "—"}
                    </td>
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

function Kpi({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`tnum mt-1 text-2xl font-semibold ${alert ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
