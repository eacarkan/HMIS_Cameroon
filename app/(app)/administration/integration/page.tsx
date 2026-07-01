import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  ConnectorForm,
  CredentialReferenceForm,
  CreateSystemForm,
  RetryJobButton,
  RunJobForm,
} from "@/components/admin/integration-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getIntegrationOverview } from "@/server/services";

/**
 * Phase 4A — Integration framework & external-system registry. MOCK / sandbox-first: every connector
 * is a mock and the framework makes NO live external call (a PRODUCTION_DISABLED connector cannot run).
 * Integration-admin only (separate from clinical roles); per-hospital RBAC server-authoritative;
 * credential REFERENCES only (never secrets); all actions audited. Synthetic data only.
 */
export default async function IntegrationPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "integration.job.view")) redirect("/");
  const canManage = can(rolesHere, "integration.system.manage");

  const t = await getTranslations("integration");
  const { systems, jobs, liveEnabled } = await getIntegrationOverview(actor, hospital);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("mockNotice")}</strong> · {t("noLiveCalls")}{" "}
        {liveEnabled ? null : <span className="text-muted-foreground">({t("liveOff")})</span>}
      </div>

      {canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("createSystem")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateSystemForm />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("systemsFor", { hospital: hospital.name })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {systems.length === 0 ? <p className="text-muted-foreground text-sm">{t("noSystems")}</p> : null}
          {systems.map((s) => (
            <div key={s.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {s.code} — {s.name}{" "}
                  <span className="text-muted-foreground text-xs">({s.kind})</span>
                </span>
                <Badge variant="outline">{t(`systemStatuses.${s.status}`)}</Badge>
              </div>

              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">{t("connectors")}:</span>{" "}
                {s.connectors.length === 0 ? (
                  <span className="text-muted-foreground">{t("none")}</span>
                ) : (
                  s.connectors.map((c) => (
                    <span key={c.id} className="mr-2">
                      {c.name} <Badge variant="secondary">{c.environment}</Badge>
                      {c.isActive ? "" : ` (${t("inactive")})`}
                      {c.lastError ? <span className="text-destructive"> · {c.lastError}</span> : null}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-1 text-xs">
                <span className="text-muted-foreground">{t("credentials")}:</span>{" "}
                {s.credentialReferences.length === 0 ? (
                  <span className="text-muted-foreground">{t("none")}</span>
                ) : (
                  s.credentialReferences.map((r) => (
                    <span key={r.id} className="mr-2">
                      {r.name} <span className="text-muted-foreground">[{r.referenceKind}: {r.referenceValue}]</span>
                    </span>
                  ))
                )}
              </div>

              {canManage ? (
                <div className="mt-3 grid gap-3 border-t pt-3">
                  <ConnectorForm systemId={s.id} />
                  <CredentialReferenceForm systemId={s.id} />
                  <RunJobForm systemId={s.id} />
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("jobs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noJobs")}</p>
          ) : (
            <div className="grid gap-2 text-sm">
              {jobs.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                  <span>
                    <span className="font-medium">{j.kind}</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      {j.externalSystem.code}
                      {j.connector ? ` · ${j.connector.name} (${j.connector.environment})` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={j.status === "FAILED" ? "destructive" : "secondary"}>
                      {t(`jobStatuses.${j.status}`)}
                    </Badge>
                    <span className="text-muted-foreground tnum text-xs">
                      {t("attempts")}: {j.attempts}/{j.maxAttempts}
                    </span>
                    {j.lastError ? (
                      <span className="text-destructive text-xs">{j.lastError}</span>
                    ) : null}
                    {canManage && j.status === "FAILED" && j.attempts < j.maxAttempts ? (
                      <RetryJobButton jobId={j.id} />
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
