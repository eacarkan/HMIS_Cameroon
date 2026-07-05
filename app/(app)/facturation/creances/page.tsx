import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getReceivablesAging } from "@/server/services";

export default async function ReceivablesAgingPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "receivables.view")) redirect("/");

  const aging = await getReceivablesAging(actor, hospital);
  const t = await getTranslations("finance");

  return (
    <>
      <PageHeader title={t("aging.title")} description={t("aging.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("aging.totalReceivables")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-2xl font-bold">{formatFcfa(aging.total)}</p>
            <p className="text-muted-foreground text-sm">
              {t("aging.asOf")} {formatDateFr(new Date(aging.asOf))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("aging.invoices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">{formatFcfa(aging.invoicesOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("aging.emergencyDebts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tnum text-xl font-semibold">{formatFcfa(aging.emergencyOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("aging.bucket")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-1.5 font-medium">{t("aging.bucket")}</th>
                  <th className="py-1.5 text-right font-medium">{t("aging.invoices")}</th>
                  <th className="py-1.5 text-right font-medium">{t("aging.emergencyDebts")}</th>
                  <th className="py-1.5 text-right font-medium">{t("aging.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {aging.buckets.map((b) => (
                  <tr key={b.bucket} className="border-b last:border-0">
                    <td className="py-1.5 font-medium">{b.bucket}</td>
                    <td className="tnum py-1.5 text-right">{formatFcfa(b.invoiceAmount)}</td>
                    <td className="tnum py-1.5 text-right">{formatFcfa(b.debtAmount)}</td>
                    <td className="tnum py-1.5 text-right font-semibold">{formatFcfa(b.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="py-2">{t("aging.totalReceivables")}</td>
                  <td className="tnum py-2 text-right">{formatFcfa(aging.invoicesOutstanding)}</td>
                  <td className="tnum py-2 text-right">{formatFcfa(aging.emergencyOutstanding)}</td>
                  <td className="tnum py-2 text-right">{formatFcfa(aging.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {aging.reconciles ? (
            <p className="mt-3 text-xs text-emerald-700">✓ {t("aging.reconciles")}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("aging.detail")}</CardTitle>
        </CardHeader>
        <CardContent>
          {aging.detail.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("aging.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("aging.invoiceNumber")}</th>
                    <th className="py-1.5 font-medium">{t("aging.patient")}</th>
                    <th className="py-1.5 text-right font-medium">{t("aging.billed")}</th>
                    <th className="py-1.5 text-right font-medium">{t("aging.paid")}</th>
                    <th className="py-1.5 text-right font-medium">{t("aging.outstanding")}</th>
                    <th className="py-1.5 text-right font-medium">{t("aging.ageDays")}</th>
                    <th className="py-1.5 text-right font-medium">{t("aging.bucket")}</th>
                  </tr>
                </thead>
                <tbody>
                  {aging.detail.slice(0, 100).map((r) => (
                    <tr key={r.invoiceNumber} className="border-b last:border-0">
                      <td className="tnum py-1.5">{r.invoiceNumber}</td>
                      <td className="tnum py-1.5">{r.patientNumber}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(r.billed)}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(r.paid)}</td>
                      <td className="tnum py-1.5 text-right font-medium">{formatFcfa(r.outstanding)}</td>
                      <td className="tnum py-1.5 text-right">{r.ageDays}</td>
                      <td className="py-1.5 text-right">{r.bucket}</td>
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
