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

/**
 * Public feature showcase (Phase 6B; restyled 6.3B). The curated showcase content lives in
 * the client `PublicShowcase`; the server page injects the server-rendered patient-journey
 * stepper and guided-demo pathway as slots (RSC composition — no client re-implementation).
 */
export default async function VitrinePage() {
  const t = await getTranslations("landing.journey");
  return (
    <PublicShowcase
      journey={
        <section className="mt-14" aria-labelledby="vitrine-journey-title">
          <h2
            id="vitrine-journey-title"
            className="font-heading text-2xl font-bold tracking-tight"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-2 mb-9 max-w-[70ch] text-sm">
            {t("subtitle")}
          </p>
          <PatientJourneyFlow />
        </section>
      }
      guided={
        <section className="mt-14">
          <GuidedDemoCard />
        </section>
      }
    />
  );
}
