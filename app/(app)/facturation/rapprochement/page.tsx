import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NewSlipForm, ImportStatementButton } from "@/components/finance/reconciliation-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getReconciliationOverview } from "@/server/services";

const STATUS_KEY: Record<string, string> = {
  prepared: "statusPrepared",
  deposited: "statusDeposited",
  cleared: "statusCleared",
  disputed: "statusDisputed",
};

export default async function ReconciliationOverviewPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "reconciliation.view")) redirect("/");
  const canManage = can(rolesHere, "reconciliation.manage");

  const { slips, bankLines } = await getReconciliationOverview(actor, hospital);
  const t = await getTranslations("finance");

  return (
    <>
      <PageHeader title={t("reconciliation.title")} description={t("reconciliation.subtitle")} />

      {canManage ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("reconciliation.newSlip")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <NewSlipForm />
            <ImportStatementButton />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("reconciliation.slips")}</CardTitle>
        </CardHeader>
        <CardContent>
          {slips.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("reconciliation.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("reconciliation.slipNumber")}</th>
                    <th className="py-1.5 font-medium">{t("reconciliation.depositDate")}</th>
                    <th className="py-1.5 font-medium">{t("reconciliation.status")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.declared")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.computed")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.cleared")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.variance")}</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {slips.map((s) => {
                    const gap = s.varianceFcfa !== 0 || s.status !== "cleared";
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="tnum py-1.5 font-medium">{s.slipNumber}</td>
                        <td className="tnum py-1.5">{formatDateFr(new Date(s.depositDate))}</td>
                        <td className="py-1.5">
                          <Badge variant={s.status === "cleared" ? "default" : s.status === "disputed" ? "destructive" : "secondary"}>
                            {t(`reconciliation.${STATUS_KEY[s.status]}`)}
                          </Badge>
                        </td>
                        <td className="tnum py-1.5 text-right">{formatFcfa(s.declaredTotalFcfa)}</td>
                        <td className="tnum py-1.5 text-right">{formatFcfa(s.computedPaymentTotalFcfa)}</td>
                        <td className="tnum py-1.5 text-right">{formatFcfa(s.clearedAmountFcfa)}</td>
                        <td className={`tnum py-1.5 text-right ${s.varianceFcfa !== 0 ? "font-semibold text-amber-700" : ""}`}>
                          {formatFcfa(s.varianceFcfa)}
                        </td>
                        <td className="py-1.5 text-right">
                          <Link className="text-primary hover:underline" href={`/facturation/rapprochement/${s.id}`}>
                            {t("reconciliation.open")} →
                          </Link>
                          {gap ? <span className="ml-2 text-xs text-amber-700">● {t("reconciliation.gap")}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("reconciliation.bankLines")}</CardTitle>
        </CardHeader>
        <CardContent>
          {bankLines.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("reconciliation.noBankLines")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("reconciliation.label")}</th>
                    <th className="py-1.5 font-medium">{t("reconciliation.reference")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.amount")}</th>
                    <th className="py-1.5 font-medium">{t("reconciliation.matchStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bankLines.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-1.5">{l.label}</td>
                      <td className="tnum text-muted-foreground py-1.5">{l.reference ?? "—"}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(l.amountFcfa)}</td>
                      <td className="py-1.5">
                        <Badge variant={l.matchStatus === "matched" ? "default" : "secondary"}>
                          {l.matchStatus === "matched" ? t("reconciliation.matched") : t("reconciliation.unmatched")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 text-xs">{t("reconciliation.readOnlyNote")}</p>
    </>
  );
}
