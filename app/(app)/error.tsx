"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Consistent error boundary for the authenticated app (Phase 1A Batch 6). Shows a calm
 * French message and a retry — never leaks stack traces / internals to the user.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    // Surfaced to server logs by Next.js; not shown to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t("description")}</p>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  );
}
