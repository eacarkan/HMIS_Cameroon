"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALE_COOKIE } from "@/i18n/request";

/**
 * Language toggle (Phase 2A — progressive bilingual UI). Sets the `locale` cookie and
 * revalidates the layout so the new locale applies. French is the default; only `fr`/`en`
 * are accepted. UI-preference only — no data, no scoping concern.
 */
export async function setLocaleAction(locale: string): Promise<void> {
  const value = locale === "en" ? "en" : "fr";
  (await cookies()).set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
