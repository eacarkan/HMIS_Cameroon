import {
  Activity,
  Banknote,
  BedDouble,
  FlaskConical,
  Landmark,
  Pill,
  ShieldCheck,
  Users,
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
 * Public landing page (Phase 6.3 — hybrid « Réseau » hero + « Registre » cards). Deep-teal
 * hero band with the Cameroon hospital constellation, then flat directory-grid sections:
 * regional network, patient journey, platform modules, disclaimers, guided demo, closing
 * CTA. Static/synthetic only — no operational reads, no auth, no forms in <main>.
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

  return (
    <div>
      {/* ============ Hero — direction « Réseau » ============ */}
      <section className="relative overflow-hidden text-(--hero-foreground) [background:linear-gradient(148deg,var(--hero)_0%,var(--primary)_58%,#10677b_100%)]">
        <HeroConstellation className="text-hero-muted pointer-events-none absolute top-1/2 right-8 hidden w-[340px] -translate-y-1/2 lg:block" />
        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-16 lg:px-8 lg:py-20">
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
            <p className="mt-4 min-h-[14.5rem] max-w-[56ch] text-base leading-relaxed text-(--hero-muted) sm:min-h-[9rem] lg:min-h-[7rem]">
              {t("hero.description")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-(--hero) hover:bg-white/90"
              >
                <Link href="/acces-demo">{t("hero.ctaDemo")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/45 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/vitrine">{t("hero.ctaFeatures")}</Link>
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
        {/* ============ Regional network — direction « Registre » ============ */}
        <section className="pt-16" aria-labelledby="network-title">
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

        {/* ============ Patient journey ============ */}
        <section className="pt-16" aria-labelledby="journey-title">
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

        {/* ============ Platform modules ============ */}
        <section className="pt-16" aria-labelledby="modules-title">
          <h2
            id="modules-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("modules.title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-7 max-w-[70ch] text-sm">
            {t("modules.subtitle")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* ============ Mandatory disclaimers ============ */}
        <section className="pt-14">
          <PublicDisclaimers />
        </section>

        {/* ============ Guided demo pathway ============ */}
        <section className="pt-14">
          <GuidedDemoCard />
        </section>

        {/* ============ Closing CTA ============ */}
        <section className="border-primary/20 bg-primary/5 my-16 rounded-xl border p-8 text-center">
          <h2 className="font-heading text-xl font-semibold">{t("cta.title")}</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            {t("cta.body")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/acces-demo">{t("cta.primary")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/vitrine">{t("cta.secondary")}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
