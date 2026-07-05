import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getMobileMoneyReport } from "@/server/services";

/** Shift a `YYYY-MM` period key by ±1 month (for the previous/next-month links). */
function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MobileMoneyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "momo.report.read")) redirect("/");

  const { period } = await searchParams;
  const report = await getMobileMoneyReport(actor, hospital, { period });
  const t = await getTranslations("finance");

  return (
    <>
      <PageHeader title={t("momo.title")} description={t("momo.subtitle")} />

      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link className="text-primary hover:underline" href={`?period=${shiftPeriod(report.period, -1)}`}>
          ← {shiftPeriod(report.period, -1)}
        </Link>
        <span className="font-medium">
          {t("momo.period")} : {report.periodLabel}
        </span>
        <Link className="text-primary hover:underline" href={`?period=${shiftPeriod(report.period, 1)}`}>
          {shiftPeriod(report.period, 1)} →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("momo.totalCollected")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-2xl font-bold">{formatFcfa(report.total)}</p>
            <p className="text-muted-foreground text-sm">
              {report.count} {t("momo.count").toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("momo.operatorBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.byOperator.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("momo.empty")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("momo.operator")}</th>
                    <th className="py-1.5 text-right font-medium">{t("momo.count")}</th>
                    <th className="py-1.5 text-right font-medium">{t("momo.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byOperator.map((r) => (
                    <tr key={r.operator} className="border-b last:border-0">
                      <td className="py-1.5 font-medium">{r.operator}</td>
                      <td className="tnum py-1.5 text-right">{r.count}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("momo.recent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("momo.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("momo.date")}</th>
                    <th className="py-1.5 font-medium">{t("momo.receipt")}</th>
                    <th className="py-1.5 font-medium">{t("momo.operator")}</th>
                    <th className="py-1.5 font-medium">{t("momo.reference")}</th>
                    <th className="py-1.5 text-right font-medium">{t("momo.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, 50).map((r) => (
                    <tr key={r.receiptNumber} className="border-b last:border-0">
                      <td className="tnum py-1.5">{formatDateFr(new Date(r.paidAt))}</td>
                      <td className="tnum py-1.5">{r.receiptNumber}</td>
                      <td className="py-1.5">{r.operator}</td>
                      <td className="tnum py-1.5 text-muted-foreground">{r.reference ?? "—"}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 text-xs">{t("workspace.note")}</p>
    </>
  );
}
