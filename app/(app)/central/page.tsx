import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDateFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getCentralOversight } from "@/server/services";
import type { CentralOversightHospital } from "@/server/services/central-oversight-service";

/**
 * Phase 3D — Central aggregate oversight (read-only, AGGREGATE-ONLY); executive restyle
 * 6.3 S4 (6.3E). Reads ONLY per-hospital snapshots (never operational patient-level
 * tables). No drilldown to any patient. Gated on the GLOBAL `central.aggregate.view`.
 * Synthetic data only — the page says so explicitly and implies no real-time connection.
 */
export default async function CentralOversightPage() {
  // requireActorAndHospital gives a session; central.aggregate.view is a GLOBAL capability.
  const { actor } = await requireActorAndHospital();
  if (!can(actor.roles, "central.aggregate.view")) redirect("/");

  const t = await getTranslations("central");
  const tMethod = await getTranslations("paymentMethod");
  const { hospitals } = await getCentralOversight(actor);
  const maxConsultations = Math.max(...hospitals.map((h) => h.indicators.consultationCount), 1);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <p className="text-muted-foreground -mt-2 mb-5 flex items-start gap-1.5 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("noPatientNotice")}
      </p>

      {hospitals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-muted-foreground max-w-md text-sm">{t("noData")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 6.3I — hospital activity comparison (SVG/CSS bars over snapshot aggregates) */}
          <section
            aria-labelledby="central-comparison-title"
            className="bg-card rounded-xl border shadow-(--shadow-card)"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
              <h2 id="central-comparison-title" className="text-[13px] font-bold tracking-tight">
                {t("comparisonTitle")}
              </h2>
              <p className="text-muted-foreground text-[11px]">{t("comparisonCaption")}</p>
            </div>
            <ul className="grid list-none gap-2 px-4 py-3.5">
              {hospitals.map((h) => (
                <li
                  key={h.hospitalId}
                  className="grid grid-cols-[9.5rem_1fr_4rem] items-center gap-3 text-xs"
                >
                  <span className="truncate font-medium">{h.name}</span>
                  <span className="bg-muted block h-2 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{
                        width: `${Math.max((h.indicators.consultationCount / maxConsultations) * 100, 2)}%`,
                      }}
                    />
                  </span>
                  <span className="tnum text-right font-semibold">
                    {h.indicators.consultationCount}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Region cards */}
          <div className="grid gap-5 lg:grid-cols-2">
            {hospitals.map((h) => (
              <HospitalCard key={h.hospitalId} hospital={h} tMethod={tMethod} t={t} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function HospitalCard({
  hospital: h,
  t,
  tMethod,
}: {
  hospital: CentralOversightHospital;
  t: Awaited<ReturnType<typeof getTranslations<"central">>>;
  tMethod: Awaited<ReturnType<typeof getTranslations<"paymentMethod">>>;
}) {
  const ind = h.indicators;
  const maxRevenue = Math.max(...ind.revenueByMethod.map((r) => r.amount), 1);
  // Module-readiness chips — derived ONLY from the snapshot's aggregate counts.
  const modules: { key: string; active: boolean }[] = [
    { key: "consultations", active: ind.consultationCount > 0 },
    { key: "billing", active: ind.revenueTotalFcfa > 0 },
    { key: "queue", active: ind.queueTicketCount > 0 },
    { key: "hospitalization", active: ind.admissionCount > 0 },
    { key: "diagnostics", active: ind.diagnosticOrderCount > 0 },
    { key: "pharmacy", active: ind.pharmacy !== null },
  ];

  return (
    <article className="bg-card flex flex-col rounded-xl border shadow-(--shadow-card)">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-heading truncate text-[15px] font-bold tracking-tight">
            {h.name}
          </h3>
          <p className="text-muted-foreground text-[11px]">
            {h.region} · {h.code}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              h.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "text-muted-foreground bg-muted/40"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${h.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
              aria-hidden
            />
            {h.isActive ? t("statusActive") : t("statusPrepared")}
          </span>
          <Badge variant="secondary" className="text-[10.5px]">
            {ind.periodLabel}
          </Badge>
        </div>
      </header>

      <div className="flex-1 space-y-3.5 px-4 py-3.5 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <Stat label={t("consultations")} value={ind.consultationCount} />
          <Stat label={t("patients")} value={ind.patientCount} />
          <Stat label={t("revenue")} value={formatFcfa(ind.revenueTotalFcfa)} />
          <Stat label={t("queue")} value={ind.queueTicketCount} />
          <Stat label={t("admissions")} value={ind.admissionCount} />
          <Stat label={t("diagnostics")} value={ind.diagnosticOrderCount} />
          <Stat label={t("emergencyDebt")} value={formatFcfa(ind.emergencyDebtOutstandingFcfa)} />
          {ind.pharmacy ? (
            <Stat
              label={t("pharmacyAlerts")}
              value={`${ind.pharmacy.lowStock} / ${ind.pharmacy.expiringLots}`}
            />
          ) : null}
        </dl>

        {ind.revenueByMethod.length > 0 ? (
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs">{t("revenueByMethod")}</p>
            <ul className="grid list-none gap-1.5">
              {ind.revenueByMethod.map((row) => (
                <li
                  key={row.method}
                  className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-2 text-[11px]"
                >
                  <span className="text-muted-foreground truncate">
                    {tMethod.has(row.method) ? tMethod(row.method) : row.method}
                  </span>
                  <span className="bg-muted block h-1.5 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${Math.max((row.amount / maxRevenue) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="tnum text-right font-medium">{formatFcfa(row.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ind.topDiagnoses.length > 0 ? (
          <div>
            <p className="text-muted-foreground text-xs">{t("topDiagnoses")}</p>
            <ul className="mt-1 text-xs">
              {ind.topDiagnoses.slice(0, 3).map((d) => (
                <li key={d.code} className="flex justify-between gap-2">
                  <span className="truncate">
                    {d.code} — {d.label}
                  </span>
                  <span className="tnum shrink-0">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <footer className="border-t px-4 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {modules.map((m) => (
            <span
              key={m.key}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                m.active
                  ? "border-primary/25 bg-accent text-primary"
                  : "text-muted-foreground bg-muted/40"
              }`}
            >
              {t(`modules.${m.key}`)}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground mt-1.5 text-[10.5px]">
          {t("lastActivity")} : {formatDateFr(new Date(h.generatedAt))}
        </p>
      </footer>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tnum text-right text-xs font-semibold">{value}</dd>
    </>
  );
}
