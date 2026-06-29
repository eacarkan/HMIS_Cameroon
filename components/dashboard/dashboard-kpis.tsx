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

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import type { DashboardSummary } from "@/server/services";

/**
 * Role-specific dashboard KPIs (Phase 1A Batch 5). Renders only the sections the role may
 * see (`summary.sections`): activity for everyone, clinical for clinicians, billing for
 * cashier/oversight. Read-only figures, hospital-scoped (computed server-side).
 */
export function DashboardKpis({ summary }: { summary: DashboardSummary }) {
  const t = useTranslations("dashboard");
  const s = summary.sections;

  return (
    <div className="space-y-6">
      <Section visible={s.activity} title={t("sectionActivity")}>
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
          <Kpi key={m.method} label={m.methodLabel} value={formatFcfa(m.total)} icon={Banknote} />
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
    <div>
      <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground size-4" aria-hidden />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="tnum text-foreground text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
