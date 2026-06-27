import { getRequestConfig } from "next-intl/server";

import { LOCALE } from "@/lib/constants";

/**
 * next-intl request configuration (D-007 — French-first i18n).
 *
 * The prototype is French-only, so there is a single fixed locale and NO i18n
 * routing/middleware (no `[locale]` segment). All UI strings come from the single
 * glossary `messages/fr.json` (09 §9: "one glossary; reuse, don't reinvent").
 */
export default getRequestConfig(async () => {
  const locale = LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
