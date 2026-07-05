import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LinkPaymentForm, MatchForm, StatusButton, UnlinkButton } from "@/components/finance/reconciliation-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { depositSlipReconciles } from "@/lib/finance";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getDepositSlipDetail } from "@/server/services";

const STATUS_KEY: Record<string, string> = {
  prepared: "statusPrepared",
  deposited: "statusDeposited",
  cleared: "statusCleared",
  disputed: "statusDisputed",
};

export default async function DepositSlipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "reconciliation.view")) redirect("/");
  const canManage = can(rolesHere, "reconciliation.manage");

  const { id } = await params;
  const detail = await getDepositSlipDetail(actor, hospital, id).catch(() => null);
  if (!detail) notFound();
  const { slip, availablePayments, bankLines } = detail;
  const t = await getTranslations("finance");

  const reconciles = depositSlipReconciles(slip.declaredTotalFcfa, slip.clearedAmountFcfa);
  const transitions: { to: string; label: string }[] = [];
  if (slip.status === "prepared") {
    transitions.push({ to: "deposited", label: t("reconciliation.markDeposited") });
    transitions.push({ to: "disputed", label: t("reconciliation.markDisputed") });
  } else if (slip.status === "deposited") {
    if (reconciles) transitions.push({ to: "cleared", label: t("reconciliation.markCleared") });
    transitions.push({ to: "disputed", label: t("reconciliation.markDisputed") });
  } else if (slip.status === "cleared") {
    transitions.push({ to: "disputed", label: t("reconciliation.markDisputed") });
  }

  return (
    <>
      <PageHeader title={`${t("reconciliation.slipNumber")} ${slip.slipNumber}`} description={slip.note ?? undefined} />
      <Link className="text-primary mb-4 inline-block text-sm hover:underline" href="/facturation/rapprochement">
        ← {t("reconciliation.back")}
      </Link>

      <div className="grid gap-4 sm:grid-cols-4">
        {(
          [
            ["declared", slip.declaredTotalFcfa],
            ["computed", slip.computedPaymentTotalFcfa],
            ["cleared", slip.clearedAmountFcfa],
            ["variance", slip.varianceFcfa],
          ] as const
        ).map(([key, value]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{t(`reconciliation.${key}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`tnum text-xl font-bold ${key === "variance" && value !== 0 ? "text-amber-700" : ""}`}>
                {formatFcfa(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant={slip.status === "cleared" ? "default" : slip.status === "disputed" ? "destructive" : "secondary"}>
          {t(`reconciliation.${STATUS_KEY[slip.status]}`)}
        </Badge>
        {canManage ? transitions.map((tr) => <StatusButton key={tr.to} slipId={slip.id} to={tr.to} label={tr.label} />) : null}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("reconciliation.linkedPayments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {slip.payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("reconciliation.noLinked")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("reconciliation.receipt")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.amount")}</th>
                    <th className="py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {slip.payments.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="tnum py-1.5">{m.payment.receiptNumber}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(m.payment.amount)}</td>
                      <td className="py-1.5 text-right">
                        {canManage && slip.status !== "cleared" ? (
                          <UnlinkButton slipId={slip.id} paymentId={m.payment.id} />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canManage && slip.status !== "cleared" && slip.status !== "disputed" ? (
            <LinkPaymentForm
              slipId={slip.id}
              payments={availablePayments.map((p) => ({
                id: p.id,
                receiptNumber: p.receiptNumber,
                amount: p.amount,
                label: `${p.receiptNumber} · ${formatFcfa(p.amount)}`,
              }))}
            />
          ) : null}
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
            <div className="space-y-2">
              {bankLines.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">{l.label}</span>{" "}
                    <span className="tnum">{formatFcfa(l.amountFcfa)}</span>{" "}
                    <Badge variant={l.matchStatus === "matched" ? "default" : "secondary"}>
                      {l.matchStatus === "matched" ? t("reconciliation.matched") : t("reconciliation.unmatched")}
                    </Badge>
                  </div>
                  {canManage && slip.status !== "cleared" && l.matchStatus !== "matched" ? (
                    <MatchForm slipId={slip.id} bankLineId={l.id} defaultAmount={l.amountFcfa} />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {slip.matches.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t("reconciliation.matched")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-1.5 font-medium">{t("reconciliation.label")}</th>
                    <th className="py-1.5 font-medium">{t("reconciliation.depositDate")}</th>
                    <th className="py-1.5 text-right font-medium">{t("reconciliation.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {slip.matches.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-1.5">{m.bankStatementLine.label}</td>
                      <td className="tnum py-1.5">{formatDateFr(new Date(m.bankStatementLine.valueDate))}</td>
                      <td className="tnum py-1.5 text-right">{formatFcfa(m.matchedAmountFcfa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground mt-4 text-xs">{t("reconciliation.readOnlyNote")}</p>
    </>
  );
}
