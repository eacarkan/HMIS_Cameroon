import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import enMessages from "../messages/en.json";
import frMessages from "../messages/fr.json";

/**
 * next-intl request configuration — Phase 2A introduces **progressive** bilingual (Fr/En)
 * support. French is the default (official-document language). The active locale comes from
 * a `locale` cookie set by the in-app language toggle. English messages are OVERLAID on the
 * French base, so any key not yet translated falls back to French — the whole app is not
 * retranslated at once (baseline assumption 9). No `[locale]` routing/middleware.
 */
export const LOCALES = ["fr", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "locale";

function isAppLocale(value: string | undefined): value is AppLocale {
  return value === "fr" || value === "en";
}

type Messages = Record<string, unknown>;

/** Deep-merge: French base, the active-locale overlay on top (overlay wins where present). */
function mergeMessages(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = mergeMessages(current as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  const requested = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isAppLocale(requested) ? requested : DEFAULT_LOCALE;
  const messages =
    locale === "fr"
      ? (frMessages as Messages)
      : mergeMessages(frMessages as Messages, enMessages as Messages);
  return { locale, messages };
});
