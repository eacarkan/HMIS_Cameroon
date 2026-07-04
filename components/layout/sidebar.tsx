"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Hospital } from "lucide-react";

import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_SECTIONS } from "./nav";

/**
 * Left sidebar (06 §2, §5): the deep institutional blue-green rail with module
 * navigation and an active-state aware list. Items are filtered by the actor's
 * capabilities (09 §6) so menus visibly differ by role, then grouped into ordered
 * sections (Phase 5B) so a role with many modules sees an organised menu — grouping
 * reduces clutter WITHOUT hiding any capability-permitted item.
 */
export function Sidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const items = NAV_ITEMS.filter((item) => can(roles, item.capability));
  // Group the visible items by section, preserving the declared section + item order.
  const groups = NAV_SECTIONS.map((section) => ({
    ...section,
    items: items.filter((item) => item.section === section.key),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col md:flex">
      {/* Brand */}
      <div className="border-sidebar-border flex h-14 items-center gap-3 border-b px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-white">
          <Hospital className="size-5" aria-hidden />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">
            {tApp("name")}
          </span>
          {/* 6.3 S4 (mentor closure item 1) — review-environment framing; no official
              Ministry header without written MINSANTE authorization. */}
          <span className="text-sidebar-foreground/75 block text-xs">
            {tApp("reviewScope")}
          </span>
        </span>
      </div>

      {/* Navigation — grouped by section (each capability-permitted item still appears) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            <p className="text-sidebar-foreground/55 px-3 pb-2 text-xs font-medium tracking-wider uppercase">
              {tNav(group.labelKey)}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-none",
                        // 6.3H — refined active state: filled row + inset accent bar.
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span>{tNav(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Foot — Phase 6.4 (scope 2): a compact one-line review badge instead of the
          bulky descriptive block, so the nav scrollbar stays fully clear. */}
      <div className="border-sidebar-border shrink-0 border-t px-3 py-2">
        <p className="text-sidebar-foreground/75 flex items-center gap-1.5 truncate text-[11px] leading-tight">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-300/90" aria-hidden />
          <span className="truncate">{tApp("reviewShort")}</span>
        </p>
      </div>
    </aside>
  );
}
