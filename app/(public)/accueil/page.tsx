import { Activity, Banknote, Pill, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "SantéGrid — Plateforme synthétique de démonstration SIGH / DME",
  description:
    "SantéGrid — plateforme synthétique de démonstration d'un système d'information hospitalière (SIGH) et d'un dossier médical électronique (DME). Données fictives ; non destiné à la production.",
};

/**
 * Public landing page (Phase 6A). No login, SantéGrid brand, the mandatory synthetic-demo
 * and "not an official government website" disclaimers, and calls-to-action to the feature
 * showcase and demo access. Static/synthetic content only — no operational reads.
 */
export default async function AccueilPage() {
  const t = await getTranslations("landing");
  const tPublic = await getTranslations("publicSite");

  const highlights = [
    { icon: Activity, title: t("highlights.clinicalTitle"), body: t("highlights.clinicalBody") },
    { icon: Banknote, title: t("highlights.financialTitle"), body: t("highlights.financialBody") },
    { icon: Pill, title: t("highlights.pharmacyTitle"), body: t("highlights.pharmacyBody") },
    { icon: ShieldCheck, title: t("highlights.governanceTitle"), body: t("highlights.governanceBody") },
  ];

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-12 lg:px-8">
      {/* Hero */}
      <section className="space-y-6">
        <p className="text-primary text-xs font-medium tracking-wide uppercase">
          {t("hero.eyebrow")}
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {tPublic("tagline")}
        </h1>
        <p className="text-muted-foreground max-w-3xl text-base leading-relaxed">
          {t("hero.description")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/vitrine">{t("hero.ctaFeatures")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/acces-demo">{t("hero.ctaDemo")}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/connexion">{t("hero.ctaSignIn")}</Link>
          </Button>
        </div>
      </section>

      {/* Mandatory disclaimers */}
      <section className="mt-10">
        <PublicDisclaimers />
      </section>

      {/* Intro */}
      <section className="mt-16 max-w-3xl space-y-3">
        <h2 className="font-heading text-2xl font-semibold">{t("intro.title")}</h2>
        <p className="text-muted-foreground leading-relaxed">{t("intro.body")}</p>
      </section>

      {/* Highlights */}
      <section className="mt-10">
        <h2 className="font-heading mb-5 text-lg font-semibold">
          {t("highlights.title")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h) => (
            <Card key={h.title}>
              <CardContent className="space-y-2 py-5">
                <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
                  <h.icon className="size-5" aria-hidden />
                </span>
                <p className="font-heading font-medium">{h.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {h.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-primary/20 bg-primary/5 mt-16 rounded-xl border p-8 text-center">
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
  );
}
