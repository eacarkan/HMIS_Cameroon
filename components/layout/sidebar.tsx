"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Hospital } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * Left sidebar (06 §2, §5): the deep institutional blue-green rail with module
 * navigation and an active-state aware list. Role-aware filtering is a Step 4-5
 * concern; here every item is shown.
 */
export function Sidebar() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");

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
          <span className="text-sidebar-foreground/75 block text-xs">
            {tApp("ministry")}
          </span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-sidebar-foreground/55 px-3 pb-2 text-xs font-medium tracking-wider uppercase">
          {tNav("sectionMain")}
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
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
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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
      </nav>

      {/* Foot */}
      <div className="border-sidebar-border text-sidebar-foreground/70 border-t px-5 py-3 text-xs">
        {tApp("longName")}
      </div>
    </aside>
  );
}
