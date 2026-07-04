import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { PublicMobileMenu } from "@/components/public/public-mobile-menu";
import { SanteGridLogo } from "@/components/public/santegrid-logo";
import { Button } from "@/components/ui/button";

/**
 * Public site header (Phase 6; mobile menu 6.4). Brand wordmark + primary public
 * navigation (features / demo access / sign-in) + the Fr/En language toggle. On narrow
 * screens the inline nav overflowed (« Se connecter » clipped), so below `sm` it collapses
 * into a single compact menu button; the full inline nav shows from `sm` up. Server
 * component; links only — no operational data, no auth. Sign-in routes into the existing
 * access-controlled app at /connexion.
 */
export async function PublicHeader() {
  const t = await getTranslations("publicSite.nav");
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <Link
          href="/accueil"
          className="focus-visible:ring-ring/50 min-w-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <SanteGridLogo />
        </Link>

        {/* Desktop / tablet — full inline nav (from sm up). */}
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2" aria-label="SantéGrid">
          <Button asChild variant="ghost" size="sm">
            <Link href="/vitrine">{t("features")}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/acces-demo">{t("demo")}</Link>
          </Button>
          <Button asChild variant="default" size="sm">
            <Link href="/connexion">{t("signIn")}</Link>
          </Button>
          <span className="ml-1 inline-flex">
            <LanguageToggle />
          </span>
        </nav>

        {/* Mobile — a single compact menu, so nothing can overflow the viewport. */}
        <div className="shrink-0 sm:hidden">
          <PublicMobileMenu />
        </div>
      </div>
    </header>
  );
}
