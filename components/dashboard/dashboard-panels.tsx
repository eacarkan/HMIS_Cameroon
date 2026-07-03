import { Activity, FlaskConical, Pill, ScanLine, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { hasSeriesData } from "@/lib/dashboard-series";
import { formatFcfa } from "@/lib/money";
import { Sparkline } from "@/components/ui/sparkline";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Executive operation panels (Phase 6.3 S4 — hybrid direction, «registre» body).
 * Hand-rolled SVG/CSS visuals only (charts rule) over the capability-gated summary +
 * extras; every panel carries the synthetic tag and a polished empty state so the page
 * renders well on the rich Neon data AND on the empty e2e test DB. Server components.
 */

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border shadow-(--shadow-card)">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-[13px] font-bold tracking-tight">{title}</h2>
        {caption ? <p className="text-muted-foreground text-[11px]">{caption}</p> : null}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
      <Activity className="text-muted-foreground/60 size-5" aria-hidden />
      <p className="text-muted-foreground max-w-sm text-xs">{text}</p>
    </div>
  );
}

/** 6.3I — patients registered per day (30-day trend), SVG area sparkline. */
export async function ActivityTrendPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  const series = extras.registrationsByDay;
  return (
    <Panel title={t("registrationsTitle")} caption={t("registrationsCaption")}>
      {hasSeriesData(series) ? (
        <Sparkline
          values={series}
          width={640}
          height={72}
          className="text-primary h-[72px] w-full"
          label={t("registrationsTitle")}
        />
      ) : (
        <EmptyHint text={t("registrationsEmpty")} />
      )}
    </Panel>
  );
}

/** 6.3I — today's collections by payment method (bar rows). Billing-gated by the caller. */
export async function BillingBreakdownPanel({ summary }: { summary: DashboardSummary }) {
  const t = await getTranslations("dashboard.charts");
  const tMethod = await getTranslations("paymentMethod");
  const rows = summary.byMethod;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <Panel title={t("billingTitle")} caption={t("billingCaption")}>
      {rows.length === 0 ? (
        <EmptyHint text={t("billingEmpty")} />
      ) : (
        <ul className="grid list-none gap-2">
          {rows.map((row) => (
            <li
              key={row.method}
              className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-3 text-xs"
            >
              <span className="text-muted-foreground truncate">
                {tMethod.has(row.method) ? tMethod(row.method) : row.methodLabel}
              </span>
              <span className="bg-muted block h-2 overflow-hidden rounded-full">
                <span
                  className="bg-primary block h-full rounded-full"
                  style={{ width: `${Math.max((row.total / max) * 100, 2)}%` }}
                />
              </span>
              <span className="tnum text-right font-semibold">{formatFcfa(row.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Pharmacy + diagnostics cells (stock alerts, lab/radiology requests). Cap-gated: null = hidden. */
export async function CareOperationsPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  const cells = [
    extras.stockAlerts !== null
      ? {
          key: "stock",
          icon: TriangleAlert,
          label: t("stockAlerts"),
          value: extras.stockAlerts,
          alert: extras.stockAlerts > 0,
        }
      : null,
    extras.labRequestsToday !== null
      ? { key: "lab", icon: FlaskConical, label: t("labRequests"), value: extras.labRequestsToday }
      : null,
    extras.radiologyRequestsToday !== null
      ? {
          key: "radio",
          icon: ScanLine,
          label: t("radiologyRequests"),
          value: extras.radiologyRequestsToday,
        }
      : null,
    extras.pendingDiagnostics !== null
      ? { key: "pending", icon: Pill, label: t("pendingDiagnostics"), value: extras.pendingDiagnostics }
      : null,
  ].filter((c) => c !== null);

  if (cells.length === 0) return null;

  return (
    <Panel title={t("operationsTitle")} caption={t("operationsCaption")}>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.key} className="rounded-lg border px-3 py-2.5">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px] leading-tight">
              <cell.icon
                className={`size-3.5 shrink-0 ${"alert" in cell && cell.alert ? "text-amber-600" : ""}`}
                aria-hidden
              />
              {cell.label}
            </dt>
            <dd
              className={`tnum mt-1 text-xl font-bold tracking-tight ${"alert" in cell && cell.alert ? "text-amber-700" : ""}`}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
