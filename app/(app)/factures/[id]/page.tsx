import { Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PaymentForm } from "@/components/billing/payment-form";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getInvoice, invoiceBalance } from "@/server/services";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  const invoice = await getInvoice(actor, hospital, id);
  if (!invoice) notFound();

  const t = await getTranslations("billing");
  const tInv = await getTranslations("invoiceStatus");
  const tMethod = await getTranslations("paymentMethod");
  const tActions = await getTranslations("actions");

  const { paid, remaining } = invoiceBalance(invoice);
  const patient = invoice.encounter.patient;
  const lastPayment = invoice.payments[invoice.payments.length - 1] ?? null;

  return (
    <>
      <PatientBanner
        patient={patient}
        hospitalName={hospital.name}
        activeEncounter={{
          encounterNumber: invoice.encounter.encounterNumber,
          status: invoice.encounter.status,
        }}
      />
      <PageHeader
        title={invoice.invoiceNumber}
        description={t("invoiceTitle")}
        actions={
          <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
            {tInv(invoice.status)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("invoiceTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 font-medium">{t("designation")}</th>
                  <th className="py-2 text-center font-medium">
                    {t("quantity")}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {t("unitPrice")}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {t("lineTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{item.label}</td>
                    <td className="tnum py-2 text-center">{item.quantity}</td>
                    <td className="tnum py-2 text-right">
                      {formatFcfa(item.unitAmount)}
                    </td>
                    <td className="tnum py-2 text-right">
                      {formatFcfa(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 space-y-1.5 border-t pt-3 text-sm">
              <Line
                label={t("total")}
                value={formatFcfa(invoice.totalAmount)}
                strong
              />
              <Line label={t("paidLabel")} value={formatFcfa(paid)} />
              {remaining > 0 ? (
                <Line label={t("remaining")} value={formatFcfa(remaining)} />
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("paymentsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {remaining > 0 && can(actor.roles, "payment.record") ? (
              <PaymentForm invoiceId={invoice.id} remaining={remaining} />
            ) : null}

            {invoice.payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noPayments")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="rounded-md border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tnum font-medium">
                        {p.receiptNumber}
                      </span>
                      <span className="tnum">{formatFcfa(p.amount)}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {tMethod(p.method)} · {p.cashier?.displayName} ·{" "}
                      {formatDateTimeFr(new Date(p.paidAt))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {invoice.status === "paid" && lastPayment ? (
              <Button asChild className="w-full">
                <Link href={`/recus/${lastPayment.id}`}>
                  <Printer className="size-4" aria-hidden />
                  {tActions("printReceipt")}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
