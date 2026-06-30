import { CheckCircle2, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { GATE7_READINESS } from "@/lib/deployment-readiness";
import { requireActorAndHospital } from "@/server/auth";
import { getSystemStatus } from "@/server/services";

const READINESS_BADGE: Record<string, "secondary" | "outline" | "destructive"> = {
  ready: "secondary",
  placeholder: "outline",
  administrative: "destructive",
};

/**
 * System status / pilot-readiness page (Phase 1A Batch 6). Reports real signals (DB,
 * env, data mode, app version) and app-level readiness hooks. Visible to oversight
 * roles (config.read). NO real-data path; the fake-data marker is always shown.
 */
export default async function SystemStatusPage() {
  const { actor } = await requireActorAndHospital();
  if (!can(actor.roles, "config.read")) redirect("/");

  const status = await getSystemStatus();
  const t = await getTranslations("systemStatus");
  const tG = await getTranslations("gate7");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="border-amber-300 bg-amber-50 text-amber-900 mb-6 rounded-md border px-4 py-2 text-sm font-semibold">
        {status.dataModeLabel}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("health")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("appVersion")} value={status.appVersion} />
            <Row label={t("dataMode")} value={status.dataMode} />
            <StatusRow label={t("database")} ok={status.db.connected} />
            <Row
              label={t("serverTime")}
              value={status.db.serverTime ? formatDateTimeFr(new Date(status.db.serverTime)) : "—"}
            />
            <StatusRow label={t("envValid")} ok={status.env.ok} />
            {!status.env.ok ? (
              <p className="text-destructive text-xs">
                {t("envMissing")}: {status.env.missing.join(", ")}
              </p>
            ) : null}
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">{t("realData")}</span>
              <Badge variant={status.realDataEnabled ? "destructive" : "secondary"}>
                {status.realDataEnabled ? t("enabled") : t("disabled")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("readiness")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {status.readiness.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  {r.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">{t("readinessNote")}</p>
          </CardContent>
        </Card>

        {/* Phase 2J — Gate 7 readiness evidence. The software marks what it carries (ready/placeholder);
            administrative prerequisites are flagged as NOT software-self-authorizable. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{tG("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {GATE7_READINESS.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <span>{tG(`item_${r.key}`)}</span>
                  <Badge variant={READINESS_BADGE[r.status]}>{tG(`status_${r.status}`)}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">{tG("adminNote")}</p>
            <p className="text-muted-foreground mt-1 text-xs">{tG("backupNote")}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tnum font-medium">{value}</span>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "OK" : "KO"}</Badge>
    </div>
  );
}
