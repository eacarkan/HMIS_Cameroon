import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { APP_NAME, APP_LONG_NAME } from "@/lib/constants";
import "./globals.css";

// Inter — free, widely available, strong French-diacritic and tabular-numeral
// support (06 §4). Exposed as the Tailwind `font-sans` family.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Archivo — institutional grotesque used for headings only (Phase 6.3, direction
// « Réseau »). Self-hosted at build time by next/font (no runtime request), exposed
// as `--font-display` and mapped to the Tailwind `font-heading` family.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — Prototype`,
  description: `${APP_LONG_NAME} — prototype de démonstration (MINSANTE).`,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // French-only: a single fixed locale, no i18n routing (09 §9). The app shell is
  // composed inside the authenticated (app) group, not here — so the login screen
  // renders without it.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${archivo.variable} h-full`}>
      <body className="bg-background text-foreground min-h-full antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
