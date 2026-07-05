import { Coins, FileText, Landmark, Smartphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import { can, type Capability } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import {
  getReceivablesAging,
  getReconciliationOverview,
  getRevenueStatement,
} from "@/server/services";

const MODULES: {
  cap: Capability;
  href: string;
  icon: typeof Coins;
  titleKey: string;
  descKey: string;
}[] = [
  { cap: "momo.report.read", href: "/facturation/mobile-money", icon: Smartphone, titleKey: "openMomo", descKey: "momoDesc" },
  { cap: "receivables.view", href: "/facturation/creances", icon: Coins, titleKey: "openReceivables", descKey: "receivablesDesc" },
  { cap: "reconciliation.view", href: "/facturation/rapprochement", icon: Landmark, titleKey: "openReconciliation", descKey: "reconciliationDesc" },
  { cap: "revenue_statement.read", href: "/facturation/etat-recettes", icon: FileText, titleKey: "openStatement", descKey: "statementDesc" },
];

export default async function FinanceWorkspacePage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "invoice.read")) redirect("/");

  const t = await getTranslations("finance");

  // Francs-first KPIs — each computed only if the actor holds the relevant capability.
  const [revenue, aging, recon] = await Promise.all([
    can(rolesHere, "revenue_statement.read") ? getRevenueStatement(actor, hospital) : Promise.resolve(null),
    can(rolesHere, "receivables.view") ? getReceivablesAging(actor, hospital) : Promise.resolve(null),
    can(rolesHere, "reconciliation.view") ? getReconciliationOverview(actor, hospital) : Promise.resolve(null),
  ]);
  const unreconciled = recon
    ? recon.slips.filter((s) => s.status !== "cleared").length +
      recon.bankLines.filter((l) => l.matchStatus !== "matched").length
    : null;

  return (
    <>
      <PageHeader title={t("workspace.title")} description={t("workspace.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-3">
        {revenue ? (
          <Card>
            <CardHeader><CardTitle>{t("workspace.collectedThisMonth")}</CardTitle></CardHeader>
            <CardContent>
              <p className="tnum text-2xl font-bold">{formatFcfa(revenue.total)}</p>
              <p className="text-muted-foreground text-sm">{revenue.periodLabel}</p>
            </CardContent>
          </Card>
        ) : null}
        {aging ? (
          <Card>
            <CardHeader><CardTitle>{t("workspace.outstanding")}</CardTitle></CardHeader>
            <CardContent>
              <p className="tnum text-2xl font-bold">{formatFcfa(aging.total)}</p>
            </CardContent>
          </Card>
        ) : null}
        {unreconciled !== null ? (
          <Card>
            <CardHeader><CardTitle>{t("workspace.unreconciled")}</CardTitle></CardHeader>
            <CardContent>
              <p className="tnum text-2xl font-bold">{unreconciled}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <h2 className="mt-6 mb-3 text-sm font-semibold tracking-tight">{t("workspace.modules")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.filter((m) => can(rolesHere, m.cap)).map((m) => (
          <Link key={m.href} href={m.href} className="block">
            <Card className="hover:border-primary/40 h-full transition-colors">
              <CardHeader className="flex flex-row items-center gap-3">
                <m.icon className="text-primary size-5 shrink-0" aria-hidden />
                <CardTitle>{t(`workspace.${m.titleKey}`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{t(`workspace.${m.descKey}`)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>{t("continuity.title")}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{t("continuity.body")}</p>
          <p className="text-muted-foreground mt-2 text-xs">{t("continuity.note")}</p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 text-xs">{t("workspace.note")}</p>
    </>
  );
}
