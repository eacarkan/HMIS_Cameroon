import type { LucideIcon } from "lucide-react";

/**
 * Module / capability card (Phase 6.3). Flat « Registre » card: 1px border, icon tile,
 * heading, optional body. Presentational and generic — used for the /accueil module
 * strip and the /vitrine capability cards; reusable by Part 2 role dashboards.
 */
export function ModuleCapabilityCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
}) {
  return (
    <div className="bg-card border-border hover:border-primary/35 rounded-lg border p-5 transition-colors">
      <span className="bg-accent text-primary grid size-9 place-items-center rounded-lg">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <h3 className="font-heading mt-3 text-[15px] leading-snug font-semibold tracking-tight">
        {title}
      </h3>
      {body ? (
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{body}</p>
      ) : null}
    </div>
  );
}
