import {
  Activity,
  Banknote,
  Boxes,
  Globe2,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GuidedDemoCard } from "@/components/public/guided-demo-card";
import { PatientJourneyFlow } from "@/components/public/patient-journey-flow";
import { PublicShowcase } from "@/components/public/public-showcase";

export const metadata: Metadata = {
  title: "SantéGrid — Fonctionnalités",
  description:
    "Aperçu des modules de SantéGrid (SIGH / DME) : parcours patient, facturation, pharmacie, laboratoire, urgences, hospitalisation, reporting, assurance, sécurité et supervision — sur données synthétiques.",
};

const GOVERNANCE: { key: string; icon: LucideIcon }[] = [
  { key: "rbac", icon: ShieldCheck },
  { key: "audit", icon: ScrollText },
  { key: "payments", icon: Banknote },
  { key: "stock", icon: Boxes },
  { key: "central", icon: Globe2 },
  { key: "synthetic", icon: Activity },
];

/**
 * Public feature showcase (Phase 6B; restyled 6.3B; hero band + governance 6.4). The
 * curated showcase content lives in the client `PublicShowcase`; the server page renders
 * the full-bleed teal hero (consistent with /accueil and /connexion) and injects the
 * server-rendered patient-journey, governance/traceability and guided-demo sections as
 * RSC slots. Read-only, synthetic, no auth.
 */
export default async function VitrinePage() {
  const t = await getTranslations("showcase");
  const tJourney = await getTranslations("landing.journey");
  const tGov = await getTranslations("landing.governance");
  const tApp = await getTranslations("app");

  return (
    <div>
      {/* Full-bleed teal hero band — same language as the homepage (scope 7). */}
      <section className="relative overflow-hidden text-(--hero-foreground) [background:linear-gradient(150deg,var(--hero)_0%,var(--primary)_80%)]">
        <div className="relative mx-auto w-full max-w-screen-xl px-4 py-12 lg:px-8 lg:py-14">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden />
            {tApp("reviewEnvironmentBadge")}
          </p>
          <h1 className="font-heading mt-5 max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-(--hero-muted)">{t("subtitle")}</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-(--hero-muted)">
            {t("intro")}
          </p>
        </div>
      </section>

      <PublicShowcase
        hideHeader
        journey={
          <section className="mt-14" aria-labelledby="vitrine-journey-title">
            <h2
              id="vitrine-journey-title"
              className="font-heading text-2xl font-bold tracking-tight"
            >
              {tJourney("title")}
            </h2>
            <p className="text-muted-foreground mt-2 mb-9 max-w-[70ch] text-sm">
              {tJourney("subtitle")}
            </p>
            <PatientJourneyFlow />
          </section>
        }
        governance={
          <section className="mt-14" aria-labelledby="vitrine-governance-title">
            <h2
              id="vitrine-governance-title"
              className="font-heading text-2xl font-bold tracking-tight"
            >
              {tGov("title")}
            </h2>
            <p className="text-muted-foreground mt-2 mb-6 max-w-[70ch] text-sm">
              {tGov("subtitle")}
            </p>
            <ul className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {GOVERNANCE.map((item) => (
                <li
                  key={item.key}
                  className="bg-card flex gap-3 rounded-xl border p-4 shadow-(--shadow-card)"
                >
                  <span className="bg-accent text-primary grid size-9 shrink-0 place-items-center rounded-lg">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-heading text-[14px] leading-snug font-semibold tracking-tight">
                      {tGov(`items.${item.key}.title`)}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {tGov(`items.${item.key}.desc`)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        }
        guided={
          <section className="mt-14">
            <GuidedDemoCard />
          </section>
        }
      />
    </div>
  );
}
