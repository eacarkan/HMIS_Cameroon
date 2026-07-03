import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { HeroConstellation } from "@/components/public/hero-constellation";
import { SanteGridLogo } from "@/components/public/santegrid-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS, OFFICIAL_HEADER } from "@/lib/constants";
import { getCurrentActor } from "@/server/auth";

/**
 * Login screen (06 §14; restyled Phase 6.3J). Split layout: a deep-teal SantéGrid brand
 * panel (constellation + review-environment context) beside the sign-in card. AUTH IS
 * UNCHANGED — same LoginForm, lockout, users, passwords; the demo-accounts hint stays
 * env-gated. Rendered outside the (app) group, so no sidebar/top bar.
 */
export default async function ConnexionPage() {
  if (await getCurrentActor()) redirect("/");

  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");
  const tRoles = await getTranslations("roles");

  // The demo-accounts hint (with the shared password) is hidden by default so it never
  // appears on stakeholder-facing screenshots. Opt in for internal/dev use by building
  // with NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true. The seeded accounts themselves are unchanged.
  const showDemoAccounts = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";
  // Phase 6.1 — the demo password is no longer committed. Show only the operator-provided
  // public hint (NEXT_PUBLIC_DEMO_PASSWORD_HINT), or a neutral placeholder if unset.
  const passwordHint =
    process.env.NEXT_PUBLIC_DEMO_PASSWORD_HINT?.trim() || "fourni par l'opérateur";

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <PrototypeBanner />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[5fr_7fr]">
        {/* Brand panel — hidden on small screens, replaced by the compact header below. */}
        <aside
          className="relative hidden flex-col justify-between overflow-hidden p-10 text-(--hero-foreground) lg:flex [background:linear-gradient(160deg,var(--hero)_0%,var(--primary)_70%)]"
          aria-hidden
        >
          <HeroConstellation className="text-hero-muted pointer-events-none absolute -right-10 bottom-6 w-[300px] opacity-80" />
          <div>
            <p className="text-xs tracking-[0.18em] text-(--hero-muted) uppercase">
              {OFFICIAL_HEADER.country} · {OFFICIAL_HEADER.ministry}
            </p>
            <h1 className="font-heading mt-8 max-w-[16ch] text-3xl font-bold tracking-tight text-balance">
              {tApp("name")}
            </h1>
            <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-(--hero-muted)">
              {tApp("longName")}
            </p>
          </div>
          <p className="relative max-w-[44ch] text-xs leading-relaxed text-(--hero-muted)">
            {tApp("reviewEnvironmentNote")}
          </p>
        </aside>

        {/* Sign-in column */}
        <main className="flex flex-col p-4 sm:p-8">
          <div className="flex justify-end">
            {/* Locale can be chosen before signing in; the choice persists onto the
                authenticated app shell (fr default, en overlay). */}
            <LanguageToggle />
          </div>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-md space-y-6">
              {/* Compact brand header (all viewports; the only brand block on mobile). */}
              <div className="space-y-3">
                <SanteGridLogo />
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase lg:hidden">
                    {OFFICIAL_HEADER.country} · {OFFICIAL_HEADER.ministry}
                  </p>
                  <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                  <p className="text-primary inline-flex items-center gap-2 text-xs font-semibold">
                    <span
                      className="bg-primary/60 size-1.5 rounded-full"
                      aria-hidden
                    />
                    {tApp("reviewEnvironmentBadge")}
                  </p>
                </div>
              </div>

              <Card className="shadow-(--shadow-card)">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{t("title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                </CardContent>
              </Card>

              {showDemoAccounts ? (
                <Card className="bg-muted/40 ring-0">
                  <CardContent className="space-y-2 py-4 text-xs">
                    <p className="text-foreground font-medium">{t("demoTitle")}</p>
                    <ul className="space-y-1">
                      {DEMO_ACCOUNTS.map((account) => (
                        <li
                          key={account.email}
                          className="text-muted-foreground flex items-center justify-between gap-3"
                        >
                          <span className="truncate">{account.email}</span>
                          <span className="shrink-0">
                            {tRoles(account.roleCode)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground pt-1">
                      {t("demoPasswordLabel")} :{" "}
                      <code className="text-foreground font-semibold">
                        {passwordHint}
                      </code>
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
