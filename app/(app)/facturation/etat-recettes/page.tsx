import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GenerateStatementForm, RevenueStatementView } from "@/components/finance/revenue-statement-view";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getRevenueStatement } from "@/server/services";

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RevenueStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; number?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "revenue_statement.read")) redirect("/");

  const { period, number } = await searchParams;
  const statement = await getRevenueStatement(actor, hospital, { period });
  const t = await getTranslations("finance");

  return (
    <>
      <PageHeader title={t("statement.title")} description={t("statement.subtitle")} />

      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link className="text-primary hover:underline" href={`?period=${shiftPeriod(statement.period, -1)}`}>
          ← {shiftPeriod(statement.period, -1)}
        </Link>
        <span className="font-medium">
          {t("statement.period")} : {statement.periodLabel}
        </span>
        <Link className="text-primary hover:underline" href={`?period=${shiftPeriod(statement.period, 1)}`}>
          {shiftPeriod(statement.period, 1)} →
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{t("statement.byMethod")}</CardTitle>
          <GenerateStatementForm period={statement.period} />
        </CardHeader>
        <CardContent>
          {statement.byMethod.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("statement.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("statement.method")}</th>
                    <th className="py-1.5 text-right font-medium">{t("momo.count")}</th>
                    <th className="py-1.5 text-right font-medium">{t("statement.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.byMethod.map((r) => (
                    <tr key={r.method} className="border-b last:border-0">
                      <td className="py-1.5">{r.methodLabel}</td>
                      <td className="tnum py-1.5 text-right">{r.count}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="py-2">{t("statement.total")}</td>
                    <td className="py-2" />
                    <td className="tnum py-2 text-right">{formatFcfa(statement.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <dl className="mt-4 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("statement.totalInvoiced")}</dt>
            <dd className="tnum text-right">{formatFcfa(statement.totalInvoiced)}</dd>
            <dt className="text-muted-foreground">{t("statement.totalCollected")}</dt>
            <dd className="tnum text-right">{formatFcfa(statement.total)}</dd>
            <dt className="text-muted-foreground">{t("statement.refunds")}</dt>
            <dd className="tnum text-right">{formatFcfa(statement.refundsTotal)}</dd>
            <dt className="font-medium">{t("statement.netCollected")}</dt>
            <dd className="tnum text-right font-medium">{formatFcfa(statement.netCollected)}</dd>
            <dt className="text-muted-foreground">{t("statement.arrearsMovement")}</dt>
            <dd className="tnum text-right">{formatFcfa(statement.arrearsMovement)}</dd>
            <dt className="text-muted-foreground">{t("statement.invoiceCount")}</dt>
            <dd className="tnum text-right">{statement.invoiceCount}</dd>
          </dl>
        </CardContent>
      </Card>

      {number ? (
        <div className="mt-6">
          <RevenueStatementView
            data={{
              number,
              periodLabel: statement.periodLabel,
              hospitalName: statement.hospitalName,
              byMethod: statement.byMethod.map((r) => ({ methodLabel: r.methodLabel, count: r.count, total: r.total })),
              total: statement.total,
              paymentCount: statement.paymentCount,
              invoiceCount: statement.invoiceCount,
              totalInvoiced: statement.totalInvoiced,
              refundsTotal: statement.refundsTotal,
              netCollected: statement.netCollected,
              arrearsMovement: statement.arrearsMovement,
              generatedAtLabel: formatDateTimeFr(new Date(statement.generatedAt)),
            }}
          />
        </div>
      ) : null}

      <p className="text-muted-foreground mt-4 text-xs">{t("statement.footerNote")}</p>
    </>
  );
}
