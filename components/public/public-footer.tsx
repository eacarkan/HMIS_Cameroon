import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SanteGridLogo } from "@/components/public/santegrid-logo";

/**
 * Public site footer (Phase 6; 6.5B wording correction). A calm band restating the two
 * public-facing signals a visitor needs: synthetic data only, and that this is not an
 * official government website. The internal deployment-governance wording (Gate 7,
 * "not for production", "no live integrations") was removed from public labels — it is
 * project-control language, not useful to visitors. Server component; no operational data.
 */
export async function PublicFooter() {
  const t = await getTranslations("publicSite.footer");
  const tFeedback = await getTranslations("feedback");
  return (
    <footer className="bg-muted/30 mt-16 border-t">
      <div className="mx-auto w-full max-w-screen-xl space-y-3 px-4 py-8 text-xs lg:px-8">
        <SanteGridLogo size="sm" />
        <p className="text-muted-foreground">{t("tagline")}</p>
        <ul className="text-muted-foreground space-y-1">
          <li>{t("synthetic")}</li>
          <li className="font-medium">{t("notGovernment")}</li>
        </ul>
        <p className="pt-1">
          <Link href="/retours" className="text-primary hover:underline">
            {tFeedback("title")}
          </Link>
        </p>
        <p className="text-muted-foreground/80 pt-1">{t("release")}</p>
      </div>
    </footer>
  );
}
