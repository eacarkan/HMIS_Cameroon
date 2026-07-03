import { getTranslations } from "next-intl/server";

import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import type { DashboardSummary } from "@/server/services";

/**
 * Executive dashboard header (Phase 6.3 S4 — hybrid direction, band «A»). The deep-teal
 * institutional band from the public hero, carried into the authenticated app: hospital
 * identity (name · region · code), the signed-in role, the review-environment badge, the
 * last synthetic activity, and up to four hero KPIs. Server component; presentation only —
 * every figure comes from the capability-gated dashboard summary.
 */
export async function ExecutiveHeader({
  hospital,
  userName,
  roleLabels,
  summary,
}: {
  hospital: { name: string; region: string; code: string };
  userName: string;
  roleLabels: string[];
  summary: DashboardSummary;
}) {
  const t = await getTranslations("dashboard");
  const tApp = await getTranslations("app");

  const lastActivity = summary.recent[0]?.createdAt ?? null;
  const s = summary.sections;

  // Up to four hero cells; the third/fourth adapt to what the role may see.
  const cells: { key: string; label: string; value: string; sub?: string }[] = [
    { key: "patients", label: t("kpi.patientsToday"), value: String(summary.patientsToday) },
    {
      key: "open",
      label: t("kpi.openEncounters"),
      value: String(summary.openEncounters),
      sub: t("exec.openedClosed", {
        opened: summary.encountersOpenedToday,
        closed: summary.encountersClosedToday,
      }),
    },
    s.clinical
      ? { key: "consult", label: t("kpi.consultationsToday"), value: String(summary.consultationsToday) }
      : { key: "opened", label: t("kpi.encountersOpenedToday"), value: String(summary.encountersOpenedToday) },
    s.billing
      ? {
          key: "collections",
          label: t("kpi.collectionsToday"),
          value: formatFcfa(summary.collectionsToday),
          sub: t("exec.invoicesCount", { count: summary.invoicesToday }),
        }
      : { key: "closed", label: t("kpi.encountersClosedToday"), value: String(summary.encountersClosedToday) },
  ];

  return (
    <section
      aria-labelledby="exec-hospital"
      className="relative mb-6 overflow-hidden rounded-xl p-6 text-(--hero-foreground) [background:linear-gradient(150deg,var(--hero)_0%,var(--primary)_80%)] sm:p-7"
    >
      {/* decorative arc, echoing the public hero constellation */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full border border-white/10"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-(--hero-muted) uppercase">
            {t("title")} · {hospital.region} · {hospital.code}
          </p>
          {/* The accessible name keeps the page title (sr-only) so "Tableau de bord" /
              "Dashboard" remains the announced h1 — the hospital is the visible subject. */}
          <h1
            id="exec-hospital"
            className="font-heading mt-1.5 text-2xl font-bold tracking-tight text-balance"
          >
            <span className="sr-only">{t("title")} — </span>
            {hospital.name}
          </h1>
          <p className="mt-1 text-sm text-(--hero-muted)">{t("exec.overview")}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-(--hero-muted)">
          <p className="text-sm font-semibold text-white">{userName}</p>
          <p>{roleLabels.join(" · ")}</p>
          <p className="mt-2 inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden />
            {tApp("reviewEnvironmentBadge")}
          </p>
          <p className="mt-0.5">
            {t("exec.lastActivity")} :{" "}
            {lastActivity ? formatDateTimeFr(new Date(lastActivity)) : t("exec.noActivity")}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="rounded-lg border border-white/15 bg-white/8 px-4 py-3"
          >
            <dt className="text-[11px] leading-tight text-(--hero-muted)">{cell.label}</dt>
            <dd className="tnum mt-0.5 text-2xl font-bold tracking-tight">{cell.value}</dd>
            {cell.sub ? (
              <dd className="mt-0.5 text-[10.5px] text-(--hero-muted)">{cell.sub}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
