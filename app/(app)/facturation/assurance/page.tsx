import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  ClaimActions,
  ClaimForm,
  CoverageProfileForm,
  CreatePayerForm,
  LinkCoverageForm,
  PreAuthActions,
} from "@/components/admin/insurance-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { formatFcfa } from "@/lib/money";
import { requireActorAndHospital } from "@/server/auth";
import { getInsuranceAdmin } from "@/server/services";

/**
 * Phase 4E — insurance / mutuelle workflow foundation. MANUAL only: payer registry + coverage profiles
 * + patient coverage link + eligibility PLACEHOLDER + pre-authorization + claim drafts — no insurer API,
 * no auto-adjudication, no automatic claim submission. Billing-linked. Hospital-scoped; RBAC server-
 * authoritative. Synthetic data only.
 */
export default async function InsurancePage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "payer.manage") && !can(rolesHere, "claim.manage")) redirect("/");

  const t = await getTranslations("insurance");
  const { payers, coverages, preAuths, claims, canManagePayers, canManageClaims } = await getInsuranceAdmin(actor, hospital);
  const payerOpts = payers.map((p) => ({ id: p.id, label: `${p.code} — ${p.name}` }));
  const coverageOpts = coverages.map((c) => ({ id: c.id, label: `${c.memberNumber} (${c.payer.code})` }));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("manualNotice")}</strong>
      </div>

      {canManagePayers ? (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">{t("payers")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <CreatePayerForm />
            {payers.map((p) => (
              <div key={p.id} className="rounded-md border p-3 text-sm">
                <span className="font-medium">{p.code} — {p.name} <span className="text-muted-foreground text-xs">({p.kind})</span></span>
                <div className="text-muted-foreground mt-1 text-xs">
                  {t("profiles")}: {p.profiles.length === 0 ? t("none") : p.profiles.map((pr) => `${pr.code} ${pr.coveragePercent}%`).join(" · ")}
                </div>
                <div className="mt-2 border-t pt-2"><CoverageProfileForm payerId={p.id} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canManageClaims ? (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">{t("coverageClaim")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {payerOpts.length > 0 ? <LinkCoverageForm payers={payerOpts} /> : <p className="text-muted-foreground text-sm">{t("noPayers")}</p>}
            {coverageOpts.length > 0 ? <ClaimForm coverages={coverageOpts} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">{t("preAuths")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {preAuths.length === 0 ? <p className="text-muted-foreground text-sm">{t("noPreAuths")}</p> : null}
          {preAuths.map((pa) => (
            <div key={pa.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>{pa.description} <Badge variant="outline">{t(`preAuthStatuses.${pa.status}`)}</Badge></span>
              {canManageClaims && pa.status === "REQUESTED" ? <PreAuthActions id={pa.id} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("claims")}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {claims.length === 0 ? <p className="text-muted-foreground text-sm">{t("noClaims")}</p> : null}
          {claims.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <span>
                <span className="font-medium">{c.claimNumber}</span>{" "}
                <span className="tnum text-muted-foreground text-xs">{formatFcfa(c.amountClaimed)}</span>{" "}
                <Badge variant={c.status === "REJECTED" ? "destructive" : "secondary"}>{t(`claimStatuses.${c.status}`)}</Badge>
              </span>
              {canManageClaims ? <ClaimActions id={c.id} status={c.status} /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
