"use client";

import { useTranslations } from "next-intl";
import {
  Building2,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Search,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HospitalContext } from "@/lib/hospital-context";
import type { AuthenticatedActor } from "@/server/services";
import { selectHospitalAction, signOutAction } from "@/server/auth/actions";

export type HospitalOption = { id: string; code: string; name: string };

/**
 * Top bar (06 §5): active-hospital selector (switch between accessible hospitals),
 * (later) global search, language indicator and the signed-in user with sign-out.
 */
export function Topbar({
  actor,
  hospital,
  hospitals,
}: {
  actor: AuthenticatedActor;
  hospital: HospitalContext;
  hospitals: HospitalOption[];
}) {
  const t = useTranslations("topbar");
  const tApp = useTranslations("app");
  const tRoles = useTranslations("roles");
  const tHospital = useTranslations("hospital");

  const roleCode = actor.roles[0];
  const roleLabel = roleCode ? tRoles(roleCode) : "";
  const initials = actor.displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="bg-card flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
      {/* Active hospital — selectable context */}
      <DropdownMenu>
        <DropdownMenuTrigger className="bg-background hover:bg-accent flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none">
          <Building2 className="text-primary size-4 shrink-0" aria-hidden />
          <span className="leading-tight">
            <span className="text-muted-foreground block text-[11px]">
              {t("hospitalLabel")}
            </span>
            <span className="block max-w-[14rem] truncate text-sm font-medium">
              {hospital.name}
            </span>
          </span>
          <Badge variant="secondary" className="ml-1">
            {hospital.code}
          </Badge>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>{tHospital("switchLabel")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hospitals.map((h) => {
            const isActive = h.id === hospital.hospitalId;
            return (
              <form key={h.id} action={selectHospitalAction.bind(null, h.id)}>
                <button
                  type="submit"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                >
                  <Check
                    className={`size-4 shrink-0 ${isActive ? "text-primary" : "opacity-0"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{h.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {h.code}
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global search — placeholder (later) */}
      <div className="relative ml-2 hidden max-w-sm flex-1 lg:block">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          disabled
          placeholder={t("searchPlaceholder")}
          className="bg-background w-full rounded-md border py-1.5 pr-3 pl-9 text-sm disabled:cursor-not-allowed"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className="text-muted-foreground flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium"
          title={tApp("languageLabel")}
        >
          <Globe className="size-3.5" aria-hidden />
          {tApp("languageShort")}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-accent flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors focus-visible:outline-none">
            <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-full text-xs font-semibold">
              {initials || <User className="size-4" aria-hidden />}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">
                {actor.displayName}
              </span>
              <span className="text-muted-foreground block text-xs">
                {roleLabel}
              </span>
            </span>
            <ChevronDown className="text-muted-foreground size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <span className="block">{actor.displayName}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {roleLabel}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <button
                type="submit"
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              >
                <LogOut className="size-4" aria-hidden />
                {t("signOut")}
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
