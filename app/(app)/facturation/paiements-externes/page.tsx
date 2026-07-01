import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CreateIntentForm, CreateProviderForm, TxnActions } from "@/components/admin/external-payment-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { formatFcfa } from "@/lib/money";
import { requireActorAndHospital } from "@/server/auth";
import { getExternalPaymentAdmin } from "@/server/services";

/**
 * Phase 4D — payment provider abstraction + reconciliation. MOCK only: a confirmation NEVER marks an
 * invoice paid or rewrites history; reconciliation records a CONTROLLED payment through the existing
 * billing rule (invoice snapshots preserved). Finance-gated; hospital-scoped. Synthetic data only.
 */
export default async function ExternalPaymentsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "external_payment.view")) redirect("/");
  const canReconcile = can(rolesHere, "external_payment.reconcile");

  const t = await getTranslations("externalPayment");
  const { providers, transactions } = await getExternalPaymentAdmin(actor, hospital);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("mockNotice")}</strong> · {t("noRewrite")}
      </div>

      {canReconcile ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("createProvider")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateProviderForm />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("providers")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {providers.length === 0 ? <p className="text-muted-foreground text-sm">{t("noProviders")}</p> : null}
          {providers.map((p) => (
            <div key={p.id} className="rounded-md border p-3">
              <span className="font-medium">
                {p.code} — {p.name} <span className="text-muted-foreground text-xs">({p.channel})</span>
              </span>
              {canReconcile ? (
                <div className="mt-2 border-t pt-2">
                  <CreateIntentForm providerId={p.id} />
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {transactions.length === 0 ? <p className="text-muted-foreground text-sm">{t("noTransactions")}</p> : null}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>
                <span className="tnum font-medium">{formatFcfa(tx.amount)}</span>{" "}
                <span className="text-muted-foreground text-xs">
                  {tx.provider.code} · réf {tx.externalReference}
                  {tx.reconciledPaymentId ? ` · ${t("reconciledMark")}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={tx.status === "FAILED" || tx.status === "CANCELLED" ? "destructive" : "secondary"}>
                  {t(`statuses.${tx.status}`)}
                </Badge>
                {canReconcile ? (
                  <TxnActions id={tx.id} status={tx.status} reconciled={Boolean(tx.reconciledPaymentId)} />
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
