import { Download } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getCashierDailyReport } from "@/server/services";

/**
 * Cashier daily report (Gate 5B, 12 §5.12). Hospital-scoped, date-filtered (default today),
 * read-only over recorded payments. Integer FCFA. Visible to caissier + admin/directeur
 * (read). CSV export via `/rapports-caisse/export` (audited). Not an accounting system.
 */
export default async function CashierReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "cashier.report.read")) redirect("/");

  const { date } = await searchParams;
  const report = await getCashierDailyReport(actor, hospital, date);
  const t = await getTranslations("cashierReport");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={`/rapports-caisse/export?date=${report.date}`}>
              <Download className="size-4" aria-hidden />
              {t("exportCsv")}
            </a>
          </Button>
        }
      />

      <form action="/rapports-caisse" className="mb-4 flex items-end gap-2">
        <div className="grid gap-1.5">
          <label htmlFor="date" className="text-sm font-medium">
            {t("date")}
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={report.date}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          {t("apply")}
        </Button>
      </form>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Kpi label={t("count")} value={String(report.count)} />
        <Kpi label={t("totalCollected")} value={formatFcfa(report.total)} />
        <Kpi label={t("generatedAt")} value={formatDateTimeFr(report.generatedAt)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("receipts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noPayments")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("receiptNumber")}</th>
                  <th className="py-2 pr-4 font-medium">{t("invoiceNumber")}</th>
                  <th className="py-2 pr-4 font-medium">{t("patient")}</th>
                  <th className="py-2 pr-4 font-medium">{t("method")}</th>
                  <th className="py-2 pr-4 font-medium">{t("cashier")}</th>
                  <th className="py-2 text-right font-medium">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.receiptNumber} className="border-b last:border-0">
                    <td className="tnum py-2 pr-4">{r.receiptNumber}</td>
                    <td className="tnum py-2 pr-4">{r.invoiceNumber}</td>
                    <td className="py-2 pr-4">{r.patientName}</td>
                    <td className="py-2 pr-4">{r.methodLabel}</td>
                    <td className="text-muted-foreground py-2 pr-4">{r.cashierName}</td>
                    <td className="tnum py-2 text-right">{formatFcfa(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2.5" colSpan={5}>
                    {t("totalCollected")}
                  </td>
                  <td className="tnum py-2.5 text-right">{formatFcfa(report.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="tnum mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
