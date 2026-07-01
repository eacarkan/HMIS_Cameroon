import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreatePriceListForm,
  CreateTariffForm,
  DeactivateTariffButton,
  DeactivatePriceListButton,
} from "@/components/admin/tariff-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listPriceLists, listTariffs } from "@/server/services";

/**
 * Tariff / price-list management (Gate 4, 25 §9). Server-rendered lists via the Gate 3
 * tariff-service (integer FCFA, hospital-scoped, audited). Admins manage; cashier sees
 * read-only (and uses tariffs in billing). Tariff edits never alter historical invoices
 * (the InvoiceItem keeps its snapshot).
 */
export default async function TariffsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "tariff.read")) redirect("/");
  const canManage = can(actor.roles, "tariff.manage");

  const t = await getTranslations("admin");
  const [priceLists, tariffs] = await Promise.all([
    listPriceLists(actor, hospital),
    listTariffs(actor, hospital),
  ]);
  const plNameById = new Map(priceLists.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title={t("tariffs")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/administration">
              <ArrowLeft className="size-4" aria-hidden />
              {t("backToAdmin")}
            </Link>
          </Button>
        }
      />

      {!canManage ? (
        <p className="text-muted-foreground -mt-2 mb-4 text-sm">{t("readOnlyNotice")}</p>
      ) : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("priceLists")}</CardTitle>
          </CardHeader>
          <CardContent>
            {priceLists.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noPriceLists")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {priceLists.map((pl) => (
                  <li key={pl.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-medium">{pl.name}</span>{" "}
                      <span className="text-muted-foreground text-xs">({pl.code})</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant={pl.isActive ? "secondary" : "outline"}>
                        {pl.isActive ? t("active") : t("inactive")}
                      </Badge>
                      {canManage && pl.isActive ? <DeactivatePriceListButton id={pl.id} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? <CreatePriceListForm /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tariffs")}</CardTitle>
          </CardHeader>
          <CardContent>
            {tariffs.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noTariffs")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{t("name")}</th>
                    <th className="py-2 pr-4 font-medium">{t("code")}</th>
                    <th className="py-2 pr-8 text-right font-medium">{t("amount")}</th>
                    <th className="py-2 pr-4 pl-2 font-medium">{t("priceLists")}</th>
                    <th className="py-2 font-medium">{t("status")}</th>
                    {canManage ? <th className="py-2"></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((tf) => (
                    <tr key={tf.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{tf.label}</td>
                      <td className="text-muted-foreground py-2 pr-4">{tf.code}</td>
                      <td className="tnum py-2 pr-8 text-right">{formatFcfa(tf.amount)}</td>
                      <td className="text-muted-foreground py-2 pr-4 pl-2">
                        {tf.priceListId ? (plNameById.get(tf.priceListId) ?? "—") : "—"}
                      </td>
                      <td className="py-2">
                        <Badge variant={tf.isActive ? "secondary" : "outline"}>
                          {tf.isActive ? t("active") : t("inactive")}
                        </Badge>
                      </td>
                      {canManage ? (
                        <td className="py-2 text-right">
                          {tf.isActive ? <DeactivateTariffButton id={tf.id} /> : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canManage ? (
              <CreateTariffForm priceLists={priceLists.map((p) => ({ id: p.id, name: p.name }))} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
