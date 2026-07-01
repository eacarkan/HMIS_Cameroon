import { Hospital } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS, OFFICIAL_HEADER } from "@/lib/constants";
import { getCurrentActor } from "@/server/auth";

/**
 * Login screen (06 §14): centered card on a calm background, institutional header,
 * Identifiant / Mot de passe / Se connecter, the prototype label, and a demo-accounts
 * hint. Rendered outside the (app) group, so no sidebar/top bar.
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
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-3 text-center">
            <span className="bg-primary text-primary-foreground mx-auto grid size-12 place-items-center rounded-xl">
              <Hospital className="size-6" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {OFFICIAL_HEADER.country} · {OFFICIAL_HEADER.ministry}
              </p>
              <h1 className="text-xl font-semibold">{tApp("name")}</h1>
              <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("title")}</CardTitle>
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
      </main>
    </div>
  );
}
