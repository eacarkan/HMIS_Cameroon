import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { DemoAccountDirectory } from "@/components/public/demo-account-directory";
import { DemoLoginButtons } from "@/components/public/demo-login-buttons";
import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { Button } from "@/components/ui/button";
import { canStartOneClickDemo } from "@/lib/deployment-mode";

export const metadata: Metadata = {
  title: "SantéGrid — Accès démo",
  description:
    "Accès à la démonstration synthétique de SantéGrid : comptes de démonstration et connexion en un clic (selon la configuration). Données fictives uniquement.",
};

/**
 * Demo-access page (Phase 6C). No login. Shows the public directory of SYNTHETIC demo
 * accounts (no committed password — the shared demo password is an operator-provided
 * env hint or a placeholder) and, ONLY when one-click is enabled (stakeholder-demo mode
 * + HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true), the selected one-click role buttons. The app
 * stays access-controlled: workflow usage still requires a demo session.
 */
export default async function AccesDemoPage() {
  const t = await getTranslations("demoAccess");
  const oneClickEnabled = canStartOneClickDemo();
  const passwordHint =
    process.env.NEXT_PUBLIC_DEMO_PASSWORD_HINT?.trim() || t("passwordPlaceholder");

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 py-12 lg:px-8">
      <header className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-foreground/80 text-lg">{t("subtitle")}</p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      {/* Synthetic-data warning */}
      <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{t("warning")}</p>
      </div>

      {/* Public account directory */}
      <section className="mt-10 space-y-4">
        <h2 className="font-heading text-lg font-semibold">
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
      <section className="mt-10 space-y-3">
        <h2 className="font-heading text-lg font-semibold">
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

      {/* Mandatory disclaimers */}
      <section className="mt-10">
        <PublicDisclaimers />
      </section>
    </div>
  );
}
