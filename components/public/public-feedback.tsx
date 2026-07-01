"use client";

import { AlertTriangle, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Stakeholder feedback — EMAIL ONLY (Phase 6F). No in-app form, no inputs, no submit,
 * no database writes: just published email instructions, issue categories, and a
 * prominent "do not submit patient or sensitive data" notice. If a feedback email is
 * configured it renders a mailto link; otherwise a clearly-marked placeholder.
 */
export function PublicFeedback({ email }: { email: string | null }) {
  const t = useTranslations("feedback");
  const categories = [
    t("categoryBug"),
    t("categoryUx"),
    t("categoryFeature"),
    t("categoryContent"),
    t("categoryOther"),
  ];
  const include = [
    t("includeRole"),
    t("includePage"),
    t("includeSteps"),
    t("includeExpectation"),
  ];
  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-12 lg:px-8">
      <header className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-foreground/80 text-lg">{t("subtitle")}</p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      {/* No-patient-data warning */}
      <div className="mt-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="font-medium">{t("warning")}</p>
      </div>

      {/* Email contact (no form) */}
      <section className="mt-8 space-y-2">
        <p className="text-muted-foreground text-sm">{t("emailLabel")}</p>
        {email ? (
          <Button asChild>
            <a href={`mailto:${email}?subject=${encodeURIComponent("SantéGrid — retour")}`}>
              <Mail className="size-4" aria-hidden />
              {email}
            </a>
          </Button>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            {t("emailPlaceholder")}
          </p>
        )}
      </section>

      {/* Categories */}
      <section className="mt-8 space-y-2">
        <h2 className="font-heading text-lg font-semibold">
          {t("categoriesTitle")}
        </h2>
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          {categories.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      {/* Optional detail to include */}
      <section className="mt-6 space-y-2">
        <h2 className="font-heading text-lg font-semibold">{t("includeTitle")}</h2>
        <ul className="text-muted-foreground list-inside list-disc text-sm">
          {include.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      {/* Process */}
      <section className="mt-8 space-y-1">
        <h2 className="font-heading text-lg font-semibold">
          {t("processTitle")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("processBody")}</p>
      </section>
    </div>
  );
}
