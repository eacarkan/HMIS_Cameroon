import {
  Banknote,
  BedDouble,
  Boxes,
  ChevronRight,
  FlaskConical,
  Globe2,
  Pill,
  ReceiptText,
  Route,
  ScrollText,
  Settings2,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { can, type Capability } from "@/lib/rbac";

/**
 * Dashboard right rail (Phase 6.3 S4): role-aware workspace cards (6.3G) and the
 * authenticated guided-demo pathway (6.3F). Both are pure navigation over EXISTING
 * routes — no new metrics, no fake numbers; entries appear only when the signed-in
 * role holds the same capability that gates the module in the sidebar.
 */

/** Primary workspaces, in demo-priority order — filtered by capability, first 6 shown. */
const WORKSPACES: { href: string; labelKey: string; icon: LucideIcon; capability: Capability }[] = [
  { href: "/patients", labelKey: "patients", icon: Users, capability: "patient.read" },
  { href: "/consultations", labelKey: "consultations", icon: Stethoscope, capability: "consultation.read" },
  { href: "/facturation", labelKey: "billing", icon: ReceiptText, capability: "invoice.read" },
  { href: "/rapports-caisse", labelKey: "cashierReport", icon: Banknote, capability: "cashier.report.read" },
  { href: "/pharmacie/dispensation", labelKey: "dispensation", icon: Pill, capability: "dispense.perform" },
  { href: "/pharmacie/stock", labelKey: "pharmacyStock", icon: Boxes, capability: "stock.read" },
  { href: "/laboratoire", labelKey: "diagnostics", icon: FlaskConical, capability: "diagnostic.read" },
  { href: "/hospitalisations", labelKey: "hospitalizations", icon: BedDouble, capability: "admission.read" },
  { href: "/central", labelKey: "central", icon: Globe2, capability: "central.aggregate.view" },
  { href: "/administration", labelKey: "administration", icon: Settings2, capability: "config.read" },
  { href: "/journal-audit", labelKey: "audit", icon: ScrollText, capability: "audit.read" },
];

export async function QuickAccessCards({ roles }: { roles: string[] }) {
  const t = await getTranslations("dashboard.quickAccess");
  const tNav = await getTranslations("nav");
  const items = WORKSPACES.filter((w) => can(roles, w.capability)).slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="quick-access-title" className="bg-card rounded-xl border shadow-(--shadow-card)">
      <div className="border-b px-4 py-3">
        <h2 id="quick-access-title" className="text-[13px] font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-[11px]">{t("subtitle")}</p>
      </div>
      <ul className="divide-y px-1 py-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="hover:bg-accent group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <span className="bg-accent text-primary grid size-8 shrink-0 place-items-center rounded-lg">
                <item.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{tNav(item.labelKey)}</span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Guided demo pathway (6.3F) — static links into existing modules, capability-filtered. */
const GUIDED_STEPS: { stepKey: string; href: string; capability: Capability }[] = [
  { stepKey: "patients", href: "/patients", capability: "patient.read" },
  { stepKey: "billing", href: "/facturation", capability: "invoice.read" },
  { stepKey: "pharmacy", href: "/pharmacie/stock", capability: "stock.read" },
  { stepKey: "oversight", href: "/central", capability: "central.aggregate.view" },
];

export async function GuidedDemoRail({ roles }: { roles: string[] }) {
  const t = await getTranslations("publicSite.guided");
  const steps = GUIDED_STEPS.filter((s) => can(roles, s.capability));
  if (steps.length < 2) return null;

  return (
    <section
      aria-labelledby="guided-demo-title"
      className="overflow-hidden rounded-xl text-(--hero-foreground) [background:linear-gradient(150deg,var(--hero)_0%,var(--primary)_85%)]"
    >
      <div className="flex items-center gap-2.5 border-b border-white/15 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-white/12">
          <Route className="size-4" aria-hidden />
        </span>
        <h2 id="guided-demo-title" className="text-[13px] font-bold tracking-tight">
          {t("title")}
        </h2>
      </div>
      <ol className="list-none px-4 py-3">
        {steps.map((step, i) => (
          <li key={step.stepKey}>
            <Link
              href={step.href}
              className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-[13px] text-(--hero-muted) transition-colors hover:bg-white/8 hover:text-white"
            >
              <span
                className="grid size-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold text-white"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-white">
                {t(`steps.${step.stepKey}`)}
              </span>
              <ChevronRight
                className="size-3.5 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
