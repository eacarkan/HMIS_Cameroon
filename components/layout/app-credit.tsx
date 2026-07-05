"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Discreet authorship / technical credit for the SantéGrid demonstration.
 *
 * Rendered only in site chrome — the public footer, the sign-in page, and the
 * authenticated app-shell footer. Deliberately muted and kept SEPARATE from the
 * review-environment / synthetic-data safety wording (which is unchanged) so it reads
 * as a technical credit, never as an official MINSANTE production claim.
 *
 * NEVER placed on operational print documents (receipts, monthly revenue statements,
 * invoices, consultation notes) — those carry only the official header + prototype label.
 */
export function AppCredit({ className }: { className?: string }) {
  const t = useTranslations("app");
  return (
    <p
      className={cn(
        "text-muted-foreground/70 text-[11px] leading-relaxed",
        className,
      )}
    >
      {t("techCredit")}
    </p>
  );
}
