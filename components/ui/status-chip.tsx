import { cn } from "@/lib/utils";

/**
 * Status chip (Phase 6.3 S4.2 — scope 12: ONE chip pattern across dashboards, the
 * command strip and the /central supervision matrix). Pure presentational; the caller
 * provides the (already translated) label. `dot` adds the small state point.
 */
export type StatusChipTone = "active" | "ok" | "warn" | "muted";

const TONES: Record<StatusChipTone, { chip: string; dot: string }> = {
  active: { chip: "border-primary/25 bg-accent text-primary", dot: "bg-primary" },
  ok: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  warn: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  muted: { chip: "text-muted-foreground bg-muted/40 border-border", dot: "bg-slate-400" },
};

export function StatusChip({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: StatusChipTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        t.chip,
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
