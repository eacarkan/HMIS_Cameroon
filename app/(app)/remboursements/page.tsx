import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listRefunds } from "@/server/services";

/** Phase 2C — refund voucher list (read = caissier / admin / directeur). Hospital-scoped. */
export default async function RefundsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "refund.read")) redirect("/");

  const vouchers = await listRefunds(actor, hospital);
  const t = await getTranslations("refund");
  const statusLabel = (s: string) => t(s as "requested" | "approved" | "paid" | "cancelled");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {vouchers.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noRefunds")}</p>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("voucherNumber")}</th>
                  <th className="py-2 pr-4 font-medium">{t("invoice")}</th>
                  <th className="py-2 pr-4 font-medium">{t("patient")}</th>
                  <th className="py-2 pr-4 font-medium">{t("status")}</th>
                  <th className="py-2 pr-4 font-medium">{t("date")}</th>
                  <th className="py-2 text-right font-medium">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => {
                  const patient = v.invoice.encounter.patient;
                  return (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/remboursements/${v.id}`}
                          className="hover:text-primary tnum font-medium"
                        >
                          {v.voucherNumber}
                        </Link>
                      </td>
                      <td className="tnum py-2 pr-4">{v.invoice.invoiceNumber}</td>
                      <td className="py-2 pr-4">
                        {patient.givenName} {patient.familyName}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{statusLabel(v.status)}</Badge>
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 text-xs">
                        {formatDateTimeFr(new Date(v.createdAt))}
                      </td>
                      <td className="tnum py-2 text-right">{formatFcfa(v.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
