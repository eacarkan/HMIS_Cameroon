import {
  Banknote,
  ClipboardList,
  DoorOpen,
  FlaskConical,
  Pill,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StatusChip } from "@/components/ui/status-chip";
import { can, type Capability } from "@/lib/rbac";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Operational command strip (Phase 6.3 S4.2 — scope 2). The hospital's live work
 * queues in one row: consultation queue, open visits, invoices to collect, pending
 * diagnostics, prescriptions to dispense, stock alerts. Every figure is a REAL count
 * from the capability-gated dashboard service over the synthetic review data — an item
 * whose count the role may not read is simply absent (never a fake number). Each cell
 * links to its module only when the role may open it. Bahmni/OpenMRS lesson applied:
 * workflow first, dashboard second.
 */
type CommandItem = {
  key: string;
  icon: LucideIcon;
  value: number | null;
  href: string;
  linkCap: Capability;
  /** Amber attention tone instead of the neutral to-process tone. */
  warnWhenPositive?: boolean;
};

export async function CommandStrip({
  summary,
  extras,
  roles,
}: {
  summary: DashboardSummary;
  extras: DashboardExtras;
  roles: string[];
}) {
  const t = await getTranslations("dashboard.command");

  const all: CommandItem[] = [
    { key: "queue", icon: ClipboardList, value: extras.queueWaiting, href: "/file-attente", linkCap: "queue.read" },
    { key: "openVisits", icon: DoorOpen, value: summary.openEncounters, href: "/consultations", linkCap: "consultation.read" },
    { key: "invoicesToCollect", icon: Banknote, value: extras.invoicesToCollect, href: "/facturation", linkCap: "invoice.read" },
    { key: "pendingDiagnostics", icon: FlaskConical, value: extras.pendingDiagnostics, href: "/laboratoire", linkCap: "diagnostic.read" },
    { key: "prescriptionsToDispense", icon: Pill, value: extras.prescriptionsToDispense, href: "/pharmacie/dispensation", linkCap: "dispense.perform" },
    { key: "stockAlerts", icon: TriangleAlert, value: extras.stockAlerts, href: "/pharmacie/stock", linkCap: "stock.read", warnWhenPositive: true },
  ];
  const items = all.filter((item) => item.value !== null);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="command-strip-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="command-strip-title"
          className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-[11px]">{t("caption")}</p>
      </div>
      <ul className="bg-card grid list-none grid-cols-2 overflow-hidden rounded-xl border shadow-(--shadow-card) sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => {
          const count = item.value ?? 0;
          const tone = count === 0 ? "muted" : item.warnWhenPositive ? "warn" : "active";
          const chipLabel =
            count === 0 ? t("chipClear") : item.warnWhenPositive ? t("chipWatch") : t("chipTodo");
          const body = (
            <>
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px] font-medium">
                <span className="min-w-0 leading-tight">{t(`items.${item.key}.label`)}</span>
                <item.icon
                  className={`size-4 shrink-0 ${count > 0 && item.warnWhenPositive ? "text-amber-600" : "opacity-70"}`}
                  aria-hidden
                />
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span
                  className={`tnum text-2xl font-bold tracking-tight ${count > 0 && item.warnWhenPositive ? "text-amber-700" : "text-foreground"}`}
                >
                  {count}
                </span>
                <StatusChip tone={tone} dot>
                  {chipLabel}
                </StatusChip>
              </div>
              <p className="text-muted-foreground mt-1 truncate text-[10.5px]">
                {t(`items.${item.key}.context`)}
              </p>
            </>
          );
          const cellClass = "-mt-px -ml-px block border-t border-l px-3.5 py-3";
          return (
            <li key={item.key} className="contents">
              {can(roles, item.linkCap) ? (
                <Link
                  href={item.href}
                  aria-label={`${t(`items.${item.key}.label`)} : ${count}`}
                  className={`${cellClass} hover:bg-accent focus-visible:ring-primary/40 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
                >
                  {body}
                </Link>
              ) : (
                <div className={cellClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
