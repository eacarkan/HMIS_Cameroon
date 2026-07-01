import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { SanteGridLogo } from "@/components/public/santegrid-logo";

/**
 * Public site header (Phase 6). Brand wordmark + primary public navigation
 * (features / demo access / sign-in) + the Fr/En language toggle. Server component;
 * links only — no operational data, no auth. Sign-in routes into the existing
 * access-controlled app at /connexion.
 */
export async function PublicHeader() {
  const t = await getTranslations("publicSite.nav");
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/accueil" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <SanteGridLogo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="SantéGrid">
          <Button asChild variant="ghost" size="sm">
            <Link href="/vitrine">{t("features")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/acces-demo">{t("demo")}</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href="/connexion">{t("signIn")}</Link>
          </Button>
          <span className="ml-1 hidden sm:inline-flex">
            <LanguageToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
