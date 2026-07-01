import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * SantéGrid wordmark (Phase 6 — public web deployment). A lightweight, placeholder
 * brand mark: an institutional blue-green tile with a pulse glyph plus the "SantéGrid"
 * wordmark. Pure/presentational (no hooks) so it renders in both server and client trees.
 *
 * Brand rule: "SantéGrid" — a synthetic demonstration platform. Not MINSANTE, not an
 * official government brand.
 */
export function SanteGridLogo({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  const tile = size === "sm" ? "size-7" : "size-9";
  const glyph = size === "sm" ? "size-4" : "size-5";
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "bg-primary text-primary-foreground grid place-items-center rounded-lg",
          tile,
        )}
      >
        <Activity className={glyph} aria-hidden />
      </span>
      <span className={cn("font-heading font-semibold tracking-tight", text)}>
        Santé<span className="text-primary">Grid</span>
      </span>
    </span>
  );
}
