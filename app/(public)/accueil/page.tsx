import {
  Activity,
  Banknote,
  BedDouble,
  Boxes,
  Building2,
  FlaskConical,
  Globe2,
  Landmark,
  LayoutDashboard,
  Pill,
  Route,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { GuidedDemoCard } from "@/components/public/guided-demo-card";
import { HeroConstellation } from "@/components/public/hero-constellation";
import { HospitalNetworkGrid } from "@/components/public/hospital-network-grid";
import { ModuleCapabilityCard } from "@/components/public/module-capability-card";
import { PatientJourneyFlow } from "@/components/public/patient-journey-flow";
import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "SantéGrid — Plateforme intégrée de gestion hospitalière",
  description:
    "SantéGrid — plateforme intégrée de gestion hospitalière (SIGH / DME) présentée dans un environnement de revue à données synthétiques. Huit hôpitaux régionaux, démonstration contrôlée.",
};

/**
 * Public landing page (Phase 6.3 hybrid; Phase 6.4 — mobile-first business presentation).
 * Most viewers never enter the demo: the page must explain value, scope, governance and
 * stakeholders on its own, with demo access as a SECONDARY action. Sections: hero →
 * why it matters → modules → patient journey → app preview → regional network (compact
 * on mobile) → governance/traceability → stakeholders → disclaimers → guided demo → CTA.
 * Static/synthetic only — no operational reads, no auth, no forms in <main>.
 *
 * FR/EN layout stability (6.2B carry-over): the hero title/description reserve the taller
 * language's height per breakpoint so switching language never shifts the content below.
 */
export default async function AccueilPage() {
  const t = await getTranslations("landing");
  const tModules = await getTranslations("showcase.modules");
  const tApp = await getTranslations("app");

  const modules = [
    { icon: Users, title: tModules("patientTitle") },
    { icon: Banknote, title: tModules("billingTitle") },
    { icon: Pill, title: tModules("pharmacyTitle") },
    { icon: FlaskConical, title: tModules("labTitle") },
    { icon: BedDouble, title: tModules("hospitalizationTitle") },
    { icon: Activity, title: tModules("reportingTitle") },
    { icon: ShieldCheck, title: tModules("securityTitle") },
    { icon: Landmark, title: tModules("networkTitle") },
  ];

  const why: { key: string; icon: LucideIcon }[] = [
    { key: "workflows", icon: Route },
    { key: "billing", icon: Banknote },
    { key: "coordination", icon: FlaskConical },
    { key: "oversight", icon: Globe2 },
    { key: "audit", icon: ShieldCheck },
  ];

  const governance: { key: string; icon: LucideIcon }[] = [
    { key: "rbac", icon: ShieldCheck },
    { key: "audit", icon: ScrollText },
    { key: "payments", icon: Banknote },
    { key: "stock", icon: Boxes },
    { key: "central", icon: Globe2 },
    { key: "synthetic", icon: Activity },
  ];

  const stakeholders: { key: string; icon: LucideIcon }[] = [
    { key: "leadership", icon: Building2 },
    { key: "ministry", icon: Landmark },
    { key: "clinical", icon: Stethoscope },
    { key: "finance", icon: Banknote },
    { key: "technical", icon: Wrench },
  ];

  const previews: { key: string; icon: LucideIcon; bars: number[] }[] = [
    { key: "command", icon: LayoutDashboard, bars: [78, 52, 64, 38] },
    { key: "pharmacy", icon: Pill, bars: [44, 70, 30, 56] },
    { key: "diagnostics", icon: FlaskConical, bars: [60, 36, 74, 48] },
    { key: "central", icon: Globe2, bars: [68, 58, 40, 80] },
  ];

  return (
    <div>
      {/* ============ A · Hero — direction « Réseau » ============ */}
      <section className="relative overflow-hidden text-(--hero-foreground) [background:linear-gradient(148deg,var(--hero)_0%,var(--primary)_58%,#10677b_100%)]">
        <HeroConstellation className="text-hero-muted pointer-events-none absolute top-1/2 right-8 hidden w-[340px] -translate-y-1/2 lg:block" />
        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-12 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            {/* Chip row reserves the taller (2-line FR) height on narrow screens so the
                FR/EN switch never shifts the hero (6.2B stability rule). */}
            <div className="flex min-h-12 items-start sm:min-h-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden />
                {tApp("reviewEnvironmentBadge")}
              </p>
            </div>
            <h1 className="font-heading mt-6 min-h-[10rem] text-[34px] leading-[1.1] font-bold tracking-tight text-balance sm:min-h-[10rem] sm:text-5xl">
              {t("hero.title")}
            </h1>
            {/* 6.4 tune: the mobile reserve is trimmed from 14.5rem→13rem. FR and EN wrap to
                the SAME height (208px) at 375/390px, so a 13rem reserve still matches the tallest
                content exactly and keeps zero FR/EN shift while shrinking the hero. */}
            <p className="mt-4 min-h-[13rem] max-w-[56ch] text-base leading-relaxed text-(--hero-muted) sm:min-h-[9rem] lg:min-h-[7rem]">
              {t("hero.description")}
            </p>
            {/* 6.4 (scope 5): most viewers browse first — "explore" is the PRIMARY action,
                demo access secondary. */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-(--hero) hover:bg-white/90"
              >
                <Link href="/vitrine">{t("hero.ctaFeatures")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/45 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/acces-demo">{t("hero.ctaDemo")}</Link>
              </Button>
            </div>
            <dl className="mt-10 flex flex-wrap gap-3">
              {[
                { value: "8", label: t("stats.hospitals") },
                { value: "10", label: t("stats.roles") },
                { value: "100 %", label: t("stats.synthetic") },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3"
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-heading text-xl font-bold tabular-nums">
                    {s.value}
                  </dd>
                  <dd className="text-xs text-(--hero-muted)">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-screen-xl px-4 lg:px-8">
        {/* ============ B · Why it matters ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="why-title">
          <h2 id="why-title" className="font-heading text-2xl font-bold tracking-tight">
            {t("why.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("why.subtitle")}
          </p>
          <ul className="border-border grid list-none grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-5">
            {why.map((item) => (
              <li
                key={item.key}
                className="bg-card border-border border-r border-b p-4 sm:p-5"
              >
                <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-heading mt-2.5 text-[14px] leading-snug font-semibold tracking-tight">
                  {t(`why.items.${item.key}.title`)}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {t(`why.items.${item.key}.desc`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ C · Platform modules ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="modules-title">
          <h2
            id="modules-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("modules.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("modules.subtitle")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {modules.map((m) => (
              <ModuleCapabilityCard key={m.title} icon={m.icon} title={m.title} />
            ))}
          </div>
          <p className="mt-5">
            <Link
              href="/vitrine"
              className="text-primary focus-visible:ring-ring rounded text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {t("modules.cta")} →
            </Link>
          </p>
        </section>

        {/* ============ D · Patient journey ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="journey-title">
          <h2
            id="journey-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("journey.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-9 max-w-[70ch] text-sm">
            {t("journey.subtitle")}
          </p>
          <PatientJourneyFlow />
        </section>

        {/* ============ E · Regional network (compact on mobile) ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="network-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="network-title"
              className="font-heading text-2xl font-bold tracking-tight"
            >
              {t("network.title")}
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("network.count")}
            </span>
          </div>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("network.subtitle")}
          </p>
          <HospitalNetworkGrid />
        </section>
      </div>

      {/* ============ F · Governance & traceability (subtle band, full-bleed) ============ */}
      <section
        className="bg-primary/5 border-primary/10 mt-14 border-y sm:mt-16"
        aria-labelledby="governance-title"
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 py-12 lg:px-8 lg:py-14">
          <h2
            id="governance-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("governance.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("governance.subtitle")}
          </p>
          <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {governance.map((item) => (
              <li
                key={item.key}
                className="bg-card flex gap-3 rounded-xl border p-4 shadow-(--shadow-card)"
              >
                <span className="bg-accent text-primary grid size-9 shrink-0 place-items-center rounded-lg">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-[14px] leading-snug font-semibold tracking-tight">
                    {t(`governance.items.${item.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {t(`governance.items.${item.key}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto w-full max-w-screen-xl px-4 lg:px-8">
        {/* ============ G · Stakeholders ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="stakeholders-title">
          <h2
            id="stakeholders-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("stakeholders.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("stakeholders.subtitle")}
          </p>
          <ul className="border-border grid list-none grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-5">
            {stakeholders.map((item) => (
              <li
                key={item.key}
                className="bg-card border-border border-r border-b p-4 sm:p-5"
              >
                <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-heading mt-2.5 text-[14px] leading-snug font-semibold tracking-tight">
                  {t(`stakeholders.items.${item.key}.title`)}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {t(`stakeholders.items.${item.key}.desc`)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ H · App preview (illustrative, no login required) ============ */}
        <section className="pt-14 sm:pt-16" aria-labelledby="preview-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="preview-title"
              className="font-heading text-2xl font-bold tracking-tight"
            >
              {t("preview.title")}
            </h2>
            <span className="text-muted-foreground text-xs">{t("preview.note")}</span>
          </div>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("preview.subtitle")}
          </p>
          <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {previews.map((item) => (
              <li
                key={item.key}
                className="bg-card overflow-hidden rounded-xl border shadow-(--shadow-card)"
              >
                {/* Illustrative mini-panel — decorative bars, NOT real figures. */}
                <div
                  className="border-b px-4 pt-4 pb-3 [background:linear-gradient(150deg,var(--hero)_0%,var(--primary)_85%)]"
                  aria-hidden
                >
                  <item.icon className="size-4 text-white/90" />
                  <div className="mt-3 space-y-1.5">
                    {item.bars.map((w, i) => (
                      <div
                        key={i}
                        className="h-1.5 rounded-full bg-white/25"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-heading text-[14px] leading-snug font-semibold tracking-tight">
                    {t(`preview.items.${item.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {t(`preview.items.${item.key}.desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ Mandatory disclaimers ============ */}
        <section className="pt-14">
          <PublicDisclaimers />
        </section>

        {/* ============ Guided demo pathway ============ */}
        <section className="pt-14">
          <GuidedDemoCard />
        </section>

        {/* ============ I · Closing CTA — explore first, demo second ============ */}
        <section className="border-primary/20 bg-primary/5 my-16 rounded-xl border p-8 text-center">
          <h2 className="font-heading text-xl font-semibold">{t("cta.title")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            {t("cta.body")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/vitrine">{t("cta.primary")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/acces-demo">{t("cta.secondary")}</Link>
            </Button>
          </div>
          <p className="mt-4">
            <Link
              href="/retours"
              className="text-primary focus-visible:ring-ring rounded text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {t("cta.contact")} →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
