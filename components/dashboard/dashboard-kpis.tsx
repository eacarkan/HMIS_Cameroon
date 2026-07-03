"use client";

import {
  Activity,
  Banknote,
  DoorOpen,
  ReceiptText,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { formatFcfa } from "@/lib/money";
import type { DashboardSummary } from "@/server/services";

/**
 * Role-specific dashboard KPIs (Phase 1A Batch 5; restyled 6.3 S4 as a «registre»
 * shared-border ledger). Renders only the sections the role may see (`summary.sections`):
 * activity for everyone, clinical for clinicians, billing for cashier/oversight.
 * Read-only figures, hospital-scoped (computed server-side). `hideActivity` lets the
 * executive dashboard skip the activity row when the hero band already shows it.
 */
export function DashboardKpis({
  summary,
  hideActivity = false,
}: {
  summary: DashboardSummary;
  hideActivity?: boolean;
}) {
  const t = useTranslations("dashboard");
  const tMethod = useTranslations("paymentMethod");
  const s = summary.sections;

  return (
    <div className="space-y-5">
      <Section visible={s.activity && !hideActivity} title={t("sectionActivity")}>
        <Kpi label={t("kpi.patientsToday")} value={String(summary.patientsToday)} icon={Users} />
        <Kpi label={t("kpi.openEncounters")} value={String(summary.openEncounters)} icon={DoorOpen} />
        <Kpi label={t("kpi.encountersOpenedToday")} value={String(summary.encountersOpenedToday)} icon={Activity} />
        <Kpi label={t("kpi.encountersClosedToday")} value={String(summary.encountersClosedToday)} icon={Activity} />
      </Section>

      <Section visible={s.clinical} title={t("sectionClinical")}>
        <Kpi label={t("kpi.consultationsToday")} value={String(summary.consultationsToday)} icon={Stethoscope} />
      </Section>

      <Section visible={s.billing} title={t("sectionBilling")}>
        <Kpi label={t("kpi.invoicesToday")} value={String(summary.invoicesToday)} icon={ReceiptText} />
        <Kpi label={t("kpi.collectionsToday")} value={formatFcfa(summary.collectionsToday)} icon={Banknote} />
        {summary.byMethod.map((m) => (
          <Kpi
            key={m.method}
            label={tMethod.has(m.method) ? tMethod(m.method) : m.methodLabel}
            value={formatFcfa(m.total)}
            icon={Banknote}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  visible,
  title,
  children,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <section>
      <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {/* «Registre» ledger — one bordered container, cells share hairline borders. */}
      <div className="bg-card grid overflow-hidden rounded-xl border shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="-mt-px -ml-px border-t border-l px-4 py-3.5">
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs font-medium">
        <span className="min-w-0 leading-tight">{label}</span>
        <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
      </div>
      <div className="tnum text-foreground mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
