"use client";

import {
  BarChart3,
  BedDouble,
  Banknote,
  CheckCircle2,
  FlaskConical,
  HandCoins,
  Lock,
  Network,
  Pill,
  Receipt,
  ScrollText,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";

import type { ReactNode } from "react";

import { ModuleCapabilityCard } from "@/components/public/module-capability-card";
import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { Reveal } from "@/components/public/reveal";
import { Button } from "@/components/ui/button";

const MODULES: { key: string; icon: LucideIcon }[] = [
  { key: "patient", icon: UserRound },
  { key: "billing", icon: Receipt },
  { key: "pharmacy", icon: Pill },
  { key: "lab", icon: FlaskConical },
  { key: "emergency", icon: Siren },
  { key: "hospitalization", icon: BedDouble },
  { key: "reporting", icon: BarChart3 },
  { key: "insurance", icon: HandCoins },
  { key: "matching", icon: Users },
  { key: "security", icon: Lock },
  { key: "network", icon: Network },
];

const PROOF: { key: string; icon: LucideIcon }[] = [
  { key: "tests", icon: CheckCircle2 },
  { key: "guardrails", icon: ShieldCheck },
  { key: "financial", icon: Banknote },
  { key: "audit", icon: ScrollText },
];

/**
 * Public feature showcase (Phase 6B). No login, read-only, synthetic. Presents the
 * SantéGrid modules as curated UI preview cards, a banker/accountant-friendly proof
 * section, and a scope/readiness boundary — with NO live operational data, NO patient
 * data, NO write actions and NO source/architecture exposure. i18n-driven (`showcase.*`)
 * so it renders under next-intl and is unit-testable with `renderWithIntl`.
 */
export function PublicShowcase({
  journey,
  guided,
  governance,
  hideHeader = false,
}: {
  /** Server-rendered patient-journey section (RSC slot from the page). */
  journey?: ReactNode;
  /** Server-rendered guided-demo pathway (RSC slot from the page). */
  guided?: ReactNode;
  /** 6.4 — server-rendered governance/traceability section (RSC slot). */
  governance?: ReactNode;
  /** 6.4 — the page renders its own full-bleed hero band instead of this header. */
  hideHeader?: boolean;
}) {
  const t = useTranslations("showcase");
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-14 lg:px-8">
      {hideHeader ? null : (
        <header className="max-w-3xl">
          <div className="bg-primary mb-5 h-0.75 w-14" aria-hidden />
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-foreground/80 mt-3 text-lg">{t("subtitle")}</p>
          <p className="text-muted-foreground mt-2 leading-relaxed">{t("intro")}</p>
        </header>
      )}

      {/* Patient journey (server slot) */}
      {journey}

      {/* Module preview cards — flat « Registre » capability cards */}
      <section className="mt-14">
        <h2 className="font-heading mb-5 text-2xl font-bold tracking-tight">
          {t("modulesTitle")}
        </h2>
        {/* 6.5A — staggered settle on the capability cards (visible-by-default reveal). */}
        <Reveal stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleCapabilityCard
              key={m.key}
              icon={m.icon}
              title={t(`modules.${m.key}Title`)}
              body={t(`modules.${m.key}Body`)}
            />
          ))}
        </Reveal>
      </section>

      {/* Banker / accountant proof section */}
      <section className="bg-muted/30 mt-14 rounded-xl border p-6 lg:p-8">
        <h2 className="font-heading text-xl font-semibold">{t("proof.title")}</h2>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          {t("proof.subtitle")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PROOF.map((p) => (
            <div key={p.key} className="flex gap-3">
              <span className="text-primary mt-0.5 shrink-0">
                <p.icon className="size-5" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="font-medium">{t(`proof.${p.key}Title`)}</p>
                <p className="text-muted-foreground text-sm">
                  {t(`proof.${p.key}Body`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Governance / traceability (server slot, 6.4) */}
      {governance}

      {/* Scope / deployment-readiness boundary — restyled as a bounded card (6.4) */}
      <section className="border-primary/15 bg-primary/5 mt-10 rounded-xl border p-6 lg:p-8">
        <h2 className="font-heading text-lg font-semibold">
          {t("readiness.title")}
        </h2>
        <ul className="text-muted-foreground mt-3 space-y-1.5 text-sm">
          <li>{t("readiness.software")}</li>
          <li>{t("readiness.administrative")}</li>
          <li className="text-foreground font-medium">{t("readiness.boundary")}</li>
        </ul>
      </section>

      {/* Mandatory disclaimers */}
      <section className="mt-10">
        <PublicDisclaimers />
      </section>

      {/* Guided demo pathway (server slot) */}
      {guided}

      {/* Demo CTA */}
      <section className="border-primary/20 bg-primary/5 mt-14 rounded-xl border p-8 text-center">
        <h2 className="font-heading text-xl font-semibold">{t("demo.title")}</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
          {t("demo.body")}
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild size="lg">
            <Link href="/acces-demo">{t("demo.cta")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
