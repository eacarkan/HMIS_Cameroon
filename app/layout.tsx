import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { AppShell } from "@/components/layout/app-shell";
import { APP_NAME, APP_LONG_NAME } from "@/lib/constants";
import "./globals.css";

// Inter — free, widely available, strong French-diacritic and tabular-numeral
// support (06 §4). Exposed as the Tailwind `font-sans` family.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
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
  // French-only: a single fixed locale, no i18n routing (09 §9).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} h-full`}>
      <body className="bg-background text-foreground min-h-full antialiased">
        <NextIntlClientProvider messages={messages}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
