import {
  Banknote,
  FlaskConical,
  Info,
  Landmark,
  Pill,
  Stethoscope,
  UserCog,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DemoAccountDirectory } from "@/components/public/demo-account-directory";
import { DemoLoginButtons } from "@/components/public/demo-login-buttons";
import { GuidedDemoCard } from "@/components/public/guided-demo-card";
import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { Button } from "@/components/ui/button";
import { canStartOneClickDemo } from "@/lib/deployment-mode";

export const metadata: Metadata = {
  title: "SantéGrid — Accès à l'environnement de revue",
  description:
    "Accès à la démonstration synthétique de SantéGrid : comptes de démonstration et connexion en un clic (selon la configuration). Données fictives uniquement.",
};

/** Role groups shown to stakeholders — what each demo role demonstrates (Phase 6.3C). */
const ROLE_GROUPS = [
  { key: "oversight", icon: Landmark },
  { key: "administration", icon: UserCog },
  { key: "clinical", icon: Stethoscope },
  { key: "billing", icon: Banknote },
  { key: "pharmacy", icon: Pill },
  { key: "diagnostics", icon: FlaskConical },
] as const;

/**
 * Demo-access page (Phase 6C; restyled 6.3C). No login. Role groups explain what each
 * role demonstrates; below them, the SYNTHETIC account directory and — ONLY when
 * one-click is enabled (stakeholder-demo mode + HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true) —
 * the one-click buttons. Auth behavior, `HMIS_DEMO_SHARED_PASSWORD` handling and the
 * directory/one-click components are UNCHANGED; this page is presentation only.
 */
export default async function AccesDemoPage() {
  const t = await getTranslations("demoAccess");
  const oneClickEnabled = canStartOneClickDemo();
  const passwordHint =
    process.env.NEXT_PUBLIC_DEMO_PASSWORD_HINT?.trim() || t("passwordPlaceholder");

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-14 lg:px-8">
      <header className="max-w-3xl">
        <div className="bg-primary mb-5 h-0.75 w-14" aria-hidden />
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-foreground/80 mt-3 text-lg">{t("subtitle")}</p>
        <p className="text-muted-foreground mt-2">{t("intro")}</p>
      </header>

      {/* Synthetic-data warning */}
      <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{t("warning")}</p>
      </div>

      {/* Role groups — what each role demonstrates */}
      <section className="mt-12" aria-labelledby="role-groups-title">
        <h2
          id="role-groups-title"
          className="font-heading text-2xl font-bold tracking-tight"
        >
          {t("groupsTitle")}
        </h2>
        <div className="border-border mt-6 grid grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_GROUPS.map((g) => (
            <div
              key={g.key}
              className="bg-card border-border hover:bg-accent border-r border-b p-5 transition-colors"
            >
              <span className="bg-accent text-primary grid size-9 place-items-center rounded-lg">
                <g.icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="font-heading mt-3 text-[15px] font-semibold tracking-tight">
                {t(`groups.${g.key}.title`)}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {t(`groups.${g.key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Public account directory */}
      <section className="mt-12 space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight">
          {t("directoryTitle")}
        </h2>
        <DemoAccountDirectory passwordHint={passwordHint} />
        <div>
          <Button asChild variant="default">
            <Link href="/connexion">{t("signInCta")}</Link>
          </Button>
        </div>
      </section>

      {/* One-click demo login (flag-gated) */}
      <section className="mt-12 space-y-3">
        <h2 className="font-heading text-2xl font-bold tracking-tight">
          {t("oneClickTitle")}
        </h2>
        {oneClickEnabled ? (
          <>
            <p className="text-muted-foreground text-sm">{t("oneClickIntro")}</p>
            <DemoLoginButtons />
          </>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            {t("oneClickDisabled")}
          </p>
        )}
      </section>

      {/* Guided demo pathway */}
      <section className="mt-12">
        <GuidedDemoCard />
      </section>

      {/* Mandatory disclaimers */}
      <section className="mt-12">
        <PublicDisclaimers />
      </section>
    </div>
  );
}
