"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { setLocaleAction } from "@/server/actions/locale-actions";

/**
 * In-app language toggle (Phase 2A). French ↔ English; French is the default. Submits to a
 * server action that sets the `locale` cookie and revalidates the layout. The active locale
 * is highlighted (`aria-pressed`).
 */
export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("language");
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border px-1 py-0.5 text-xs"
      title={t("label")}
    >
      <Globe className="text-muted-foreground mx-1 size-3.5" aria-hidden />
      {(["fr", "en"] as const).map((l) => (
        <form key={l} action={setLocaleAction.bind(null, l)}>
          <button
            type="submit"
            aria-pressed={locale === l}
            className={`rounded px-1.5 py-0.5 font-medium ${
              locale === l
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t(l)}
          </button>
        </form>
      ))}
    </div>
  );
}
