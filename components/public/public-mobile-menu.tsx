"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LanguageToggle } from "@/components/layout/language-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Public mobile navigation (Phase 6.4 fix). On narrow screens the inline public nav
 * overflowed and clipped « Se connecter » / « Sign in ». This compact menu replaces it
 * below `sm`: a single hamburger trigger opening a dropdown with the same links
 * (Fonctionnalités · Accès démo · Se connecter) plus the language switch — so the
 * header is only Logo + one control, and nothing can overflow the viewport.
 */
export function PublicMobileMenu() {
  const t = useTranslations("publicSite.nav");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menu")}
        className="hover:bg-accent focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Menu className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/vitrine">{t("features")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/acces-demo">{t("demo")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/connexion" className="text-primary font-semibold">
            {t("signIn")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex justify-center px-2 py-1.5">
          <LanguageToggle />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
