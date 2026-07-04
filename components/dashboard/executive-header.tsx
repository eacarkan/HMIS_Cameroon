import { getTranslations } from "next-intl/server";

import type { WorkspaceProfile } from "@/lib/dashboard-workspace";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Executive dashboard header (Phase 6.3 S4 — hybrid band; role-aware heroes S4.2B).
 * The deep-teal institutional band: hospital identity, signed-in role, review badge,
 * last synthetic activity, and up to four hero KPIs COMPOSED PER WORKSPACE PROFILE —
 * a pharmacist leads with prescriptions/stock, a cashier with collections, a doctor
 * with the clinical queue; only admin/operations keep the hospital-wide figures.
 * Server component; every figure comes from the capability-gated dashboard service
 * (a null figure — capability not held — simply drops its cell, never a fake number).
 */
type HeroCell = { key: string; label: string; value: string; sub?: string };

export async function ExecutiveHeader({
  hospital,
  userName,
  roleLabels,
  roles,
  summary,
  extras,
  profile,
}: {
  hospital: { name: string; region: string; code: string };
  userName: string;
  roleLabels: string[];
  roles: string[];
  summary: DashboardSummary;
  extras: DashboardExtras;
  profile: WorkspaceProfile;
}) {
  const t = await getTranslations("dashboard");
  const tw = await getTranslations("dashboard.workspace");

  const tApp = await getTranslations("app");

  const lastActivity = summary.recent[0]?.createdAt ?? null;
  const s = summary.sections;

  const n = (v: number | null): string | null => (v === null ? null : String(v));
  const cell = (key: string, label: string, value: string | null, sub?: string): HeroCell | null =>
    value === null ? null : { key, label, value, sub };

  let candidates: (HeroCell | null)[];
  switch (profile) {
    case "pharmacy":
      candidates = [
        cell("toDispense", t("command.items.prescriptionsToDispense.label"), n(extras.prescriptionsToDispense)),
        cell("dispensed", tw("dispensedToday"), n(extras.dispensedToday)),
        cell("stockAlerts", t("command.items.stockAlerts.label"), n(extras.stockAlerts), tw("stockAlertsSub")),
        cell("activeLots", tw("activeLots"), n(extras.activeStockLots)),
      ];
      break;
    case "diagnostics":
      candidates = [
        cell("pending", t("command.items.pendingDiagnostics.label"), n(extras.pendingDiagnostics)),
        cell("toEnter", tw("resultsToEnter"), n(extras.diagnosticsToEnter)),
        cell("toValidate", tw("resultsToValidate"), n(extras.diagnosticsToValidate)),
        cell(
          "requestsToday",
          tw("requestsToday"),
          extras.labRequestsToday === null && extras.radiologyRequestsToday === null
            ? null
            : String((extras.labRequestsToday ?? 0) + (extras.radiologyRequestsToday ?? 0)),
          tw("requestsTodaySub", {
            lab: extras.labRequestsToday ?? 0,
            radio: extras.radiologyRequestsToday ?? 0,
          }),
        ),
      ];
      break;
    case "cashier":
      candidates = [
        cell("toCollect", t("command.items.invoicesToCollect.label"), n(extras.invoicesToCollect)),
        cell(
          "collections",
          t("kpi.collectionsToday"),
          s.billing ? formatFcfa(summary.collectionsToday) : null,
          t("exec.invoicesCount", { count: summary.invoicesToday }),
        ),
        cell("partiallyPaid", tw("partiallyPaid"), n(extras.partiallyPaidInvoices)),
        cell("invoicesToday", t("kpi.invoicesToday"), s.billing ? String(summary.invoicesToday) : null),
      ];
      break;
    case "clinical":
      candidates = [
        cell("waiting", tw("patientsWaiting"), n(extras.queueWaiting)),
        cell(
          "open",
          t("kpi.openEncounters"),
          String(summary.openEncounters),
          t("exec.openedClosed", {
            opened: summary.encountersOpenedToday,
            closed: summary.encountersClosedToday,
          }),
        ),
        cell(
          "consult",
          t("kpi.consultationsToday"),
          s.clinical ? String(summary.consultationsToday) : null,
        ),
        cell("results", tw("resultsAvailable"), n(extras.diagnosticsResultsAvailable)),
      ];
      break;
    case "central":
      // Regional supervisor — aggregate-only: NO operational hospital counts in the hero.
      // The band is an orientation to multi-site oversight; figures live on /central.
      candidates = [];
      break;
    default: {
      // admin / operations — the accepted S4.2 hospital-wide composition, but each
      // operational cell is capability-gated so a role lacking patient/encounter access
      // (e.g. a supervisor) can never see the count. The real administrateur/directeur
      // hold patient.read + encounter.read, so their accepted hero is unchanged.
      const canPatient = can(roles, "patient.read");
      const canEncounter = can(roles, "encounter.read");
      candidates = [
        cell("patients", t("kpi.patientsToday"), canPatient ? String(summary.patientsToday) : null),
        cell(
          "open",
          t("kpi.openEncounters"),
          canEncounter ? String(summary.openEncounters) : null,
          t("exec.openedClosed", {
            opened: summary.encountersOpenedToday,
            closed: summary.encountersClosedToday,
          }),
        ),
        s.clinical
          ? cell("consult", t("kpi.consultationsToday"), String(summary.consultationsToday))
          : cell(
              "opened",
              t("kpi.encountersOpenedToday"),
              canEncounter ? String(summary.encountersOpenedToday) : null,
            ),
        s.billing
          ? cell(
              "collections",
              t("kpi.collectionsToday"),
              formatFcfa(summary.collectionsToday),
              t("exec.invoicesCount", { count: summary.invoicesToday }),
            )
          : cell(
              "closed",
              t("kpi.encountersClosedToday"),
              canEncounter ? String(summary.encountersClosedToday) : null,
            ),
      ];
    }
  }
  const cells = candidates.filter((c): c is HeroCell => c !== null);

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

      {cells.length > 0 ? (
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
      ) : (
        // No operational cells for this role (e.g. the aggregate-only supervisor) — an
        // orientation line instead of an empty grid; the figures live on /central.
        <p className="mt-4 max-w-[60ch] rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-sm text-(--hero-muted)">
          {tw("centralOrientation")}
        </p>
      )}
    </section>
  );
}
