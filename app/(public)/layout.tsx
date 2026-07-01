import type { ReactNode } from "react";

import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

/**
 * Public route group (Phase 6 — SantéGrid web deployment). Renders WITHOUT the
 * authenticated app shell and WITHOUT an auth guard: these are public, read-only,
 * synthetic-demonstration pages. Locale + messages come from the root layout's
 * NextIntlClientProvider. The mandatory prototype banner is kept at the very top.
 *
 * No operational data is read here; every state-changing workflow still lives behind
 * the access-controlled (app) group.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <PrototypeBanner />
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
