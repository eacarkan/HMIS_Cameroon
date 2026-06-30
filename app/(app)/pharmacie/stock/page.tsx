import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import {
  ReceiveStockForm,
  ReleaseStaleReservationsButton,
} from "@/components/pharmacy/stock-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getStockSummary, listActiveMedications, listStock } from "@/server/services";

/** Phase 2D-3 — pharmacy stock: per-medication summary + batch ledger + receive form. */
export default async function StockPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "stock.read")) redirect("/");

  const [summary, batches] = await Promise.all([
    getStockSummary(actor, hospital),
    listStock(actor, hospital),
  ]);
  const t = await getTranslations("stock");
  const canReceive = can(actor.roles, "stock.receive");
  const medications = canReceive
    ? (await listActiveMedications(actor, hospital)).map((m) => ({
        id: m.id,
        label: m.strength ? `${m.nameFr} ${m.strength}` : m.nameFr,
      }))
    : [];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can(actor.roles, "reservation.release") ? <ReleaseStaleReservationsButton /> : null
        }
      />

      {canReceive ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("receiveTitle")}</CardTitle>
            {medications.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noMedications")}</p>
            ) : (
              <ReceiveStockForm medications={medications} />
            )}
          </CardHeader>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noStock")}</p>
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
                {summary.map((s) => (
                  <tr key={s.medicationId} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {s.nameFr}{" "}
                      <span className="text-muted-foreground text-xs">({s.code})</span>
                    </td>
                    <td className="tnum py-2 pr-4 text-right">
                      {s.totalOnHand} {s.unit}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{s.totalReserved}</td>
                    <td className="tnum py-2 pr-4 text-right font-medium">{s.available}</td>
                    <td className="py-2 pr-4">
                      {s.earliestExpiry ? formatDateFr(new Date(s.earliestExpiry)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("batches")}</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noStock")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("medication")}</th>
                  <th className="py-2 pr-4 font-medium">{t("batchNumber")}</th>
                  <th className="py-2 pr-4 font-medium">{t("expiry")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("onHand")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("reserved")}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{b.medication.nameFr}</td>
                    <td className="tnum py-2 pr-4">{b.batchNumber}</td>
                    <td className="py-2 pr-4">{formatDateFr(new Date(b.expiryDate))}</td>
                    <td className="tnum py-2 pr-4 text-right">
                      {b.quantityOnHand} {b.medication.unit}
                    </td>
                    <td className="tnum py-2 pr-4 text-right">{b.quantityReserved}</td>
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
