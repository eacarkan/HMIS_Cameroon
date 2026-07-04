import {
  Activity,
  Boxes,
  ChevronRight,
  FlaskConical,
  Pill,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StatusChip } from "@/components/ui/status-chip";
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

function EmptyHint({ text, href, action }: { text: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center">
      <Activity className="text-muted-foreground/60 size-5" aria-hidden />
      <p className="text-muted-foreground max-w-sm text-xs">{text}</p>
      {href && action ? (
        <Link href={href} className="text-primary text-xs font-semibold hover:underline">
          {action} →
        </Link>
      ) : null}
    </div>
  );
}

/** Shared 30-day trend panel (S4.2B) — one sparkline pattern for every role series. */
async function TrendPanel({
  title,
  caption,
  series,
  empty,
  emptyHref,
  emptyAction,
}: {
  title: string;
  caption: string;
  series: number[];
  empty: string;
  emptyHref?: string;
  emptyAction?: string;
}) {
  return (
    <Panel title={title} caption={caption}>
      {hasSeriesData(series) ? (
        <Sparkline
          values={series}
          width={640}
          height={72}
          className="text-primary h-[72px] w-full"
          label={title}
        />
      ) : (
        <EmptyHint text={empty} href={emptyHref} action={emptyAction} />
      )}
    </Panel>
  );
}

/** 6.3I — patients registered per day (30-day trend). Admin/operations profiles. */
export async function ActivityTrendPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  return (
    <TrendPanel
      title={t("registrationsTitle")}
      caption={t("registrationsCaption")}
      series={extras.registrationsByDay}
      empty={t("registrationsEmpty")}
    />
  );
}

/** S4.2B — consultations per day (doctor's lead visual). */
export async function ClinicalTrendPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  const tw = await getTranslations("dashboard.workspace");
  if (extras.consultationsByDay === null) return null;
  return (
    <TrendPanel
      title={t("clinicalTitle")}
      caption={t("clinicalCaption")}
      series={extras.consultationsByDay}
      empty={tw("empty.clinical")}
      emptyHref="/consultations"
      emptyAction={tw("empty.clinicalAction")}
    />
  );
}

/** S4.2B — diagnostic requests per day (lab/radiology lead visual). */
export async function DiagnosticsTrendPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  const tw = await getTranslations("dashboard.workspace");
  if (extras.diagnosticsByDay === null) return null;
  return (
    <TrendPanel
      title={t("diagnosticsTitle")}
      caption={t("diagnosticsCaption")}
      series={extras.diagnosticsByDay}
      empty={tw("empty.diagnostics")}
      emptyHref="/laboratoire"
      emptyAction={tw("empty.diagnosticsAction")}
    />
  );
}

/**
 * S4.2B — pharmacy worklist (pharmacist's lead panel). No time series exists for
 * prescriptions/dispensing in the review data, so instead of a fake chart this is an
 * honest compact worklist: each row a real count + its module. Rows whose figure the
 * role may not read are dropped.
 */
export async function PharmacyWorklistPanel({ extras }: { extras: DashboardExtras }) {
  const t = await getTranslations("dashboard.charts");
  const tw = await getTranslations("dashboard.workspace");
  const tChip = await getTranslations("dashboard.command");
  const rows = [
    extras.prescriptionsToDispense !== null
      ? {
          key: "toDispense",
          icon: Pill,
          label: tw("worklist.toDispense"),
          value: extras.prescriptionsToDispense,
          href: "/pharmacie/dispensation",
          warn: false,
        }
      : null,
    extras.stockAlerts !== null
      ? {
          key: "expiry",
          icon: TriangleAlert,
          label: tw("worklist.expiry"),
          value: extras.stockAlerts,
          href: "/pharmacie/stock",
          warn: extras.stockAlerts > 0,
        }
      : null,
    extras.activeStockLots !== null
      ? {
          key: "lots",
          icon: Boxes,
          label: tw("worklist.lots"),
          value: extras.activeStockLots,
          href: "/pharmacie/stock",
          warn: false,
        }
      : null,
    extras.dispensedToday !== null
      ? {
          key: "dispensed",
          icon: Activity,
          label: tw("worklist.dispensed"),
          value: extras.dispensedToday,
          href: "/pharmacie/rapports",
          warn: false,
        }
      : null,
  ].filter((r) => r !== null);
  if (rows.length === 0) return null;

  const allZero = rows.every((r) => r.value === 0);
  return (
    <Panel title={t("pharmacyTitle")} caption={t("pharmacyCaption")}>
      {allZero ? (
        <EmptyHint
          text={tw("empty.pharmacy")}
          href="/pharmacie/stock"
          action={tw("empty.pharmacyAction")}
        />
      ) : (
        <ul className="grid list-none gap-1">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="hover:bg-accent group flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors"
                aria-label={`${row.label} : ${row.value}`}
              >
                <row.icon
                  className={`size-4 shrink-0 ${row.warn ? "text-amber-600" : "text-muted-foreground"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
                <span
                  className={`tnum text-base font-bold ${row.warn ? "text-amber-700" : ""}`}
                >
                  {row.value}
                </span>
                <StatusChip tone={row.value === 0 ? "muted" : row.warn ? "warn" : "active"} dot>
                  {row.value === 0
                    ? tChip("chipClear")
                    : row.warn
                      ? tChip("chipWatch")
                      : tChip("chipTodo")}
                </StatusChip>
                <ChevronRight
                  className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
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
