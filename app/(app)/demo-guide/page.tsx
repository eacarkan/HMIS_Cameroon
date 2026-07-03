import {
  Banknote,
  Boxes,
  ChevronRight,
  FlaskConical,
  Globe2,
  LayoutDashboard,
  Route,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SyntheticDataNotice } from "@/components/dashboard/synthetic-data-notice";
import { PageHeader } from "@/components/layout/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { requireActorAndHospital } from "@/server/auth";

/**
 * Guided demo script (Phase 6.3 S4.2 — scope 8). A structured, bilingual presenter
 * path through the review environment: eight steps, each with its purpose, what to
 * click, what the stakeholder should notice, and a link to the EXISTING module.
 * Static server page — no tour library, no client state, read-only. Available to any
 * signed-in demo role (each linked module still enforces its own capability gate).
 */
const STEPS: { key: string; icon: LucideIcon; href: string | null }[] = [
  { key: "platform", icon: LayoutDashboard, href: "/" },
  { key: "role", icon: Users, href: "/acces-demo" },
  { key: "patients", icon: Users, href: "/patients" },
  { key: "consultation", icon: Stethoscope, href: "/consultations" },
  { key: "billing", icon: Banknote, href: "/facturation" },
  { key: "pharmacy", icon: Boxes, href: "/pharmacie/stock" },
  { key: "diagnostics", icon: FlaskConical, href: "/laboratoire" },
  { key: "oversight", icon: Globe2, href: "/central" },
] as const;

export default async function DemoGuidePage() {
  await requireActorAndHospital();
  const t = await getTranslations("demoGuide");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <StatusChip tone="active" dot>
            {t("badge")}
          </StatusChip>
        }
      />
      <div className="-mt-2 mb-5 space-y-1.5">
        <p className="text-muted-foreground max-w-3xl text-xs">{t("intro")}</p>
        <SyntheticDataNotice lastActivityAt={null} />
      </div>

      <ol className="grid max-w-4xl list-none gap-3">
        {STEPS.map((step, i) => (
          <li key={step.key}>
            <article className="bg-card rounded-xl border shadow-(--shadow-card)">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <span
                  className="bg-accent text-primary grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <step.icon className="text-primary size-4 shrink-0" aria-hidden />
                <h2 className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-tight">
                  {t(`steps.${step.key}.title`)}
                </h2>
                {step.href ? (
                  <Link
                    href={step.href}
                    className="text-primary inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold hover:underline"
                  >
                    {t("openModule")}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
              <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-[12.5px] sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
                    {t("purposeLabel")}
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{t(`steps.${step.key}.purpose`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
                    {t("actionLabel")}
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{t(`steps.${step.key}.action`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase">
                    {t("noticeLabel")}
                  </dt>
                  <dd className="mt-0.5 leading-relaxed">{t(`steps.${step.key}.notice`)}</dd>
                </div>
              </dl>
            </article>
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground mt-5 flex max-w-4xl items-start gap-1.5 text-[11px]">
        <Route className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("footerNote")}
      </p>
    </>
  );
}
