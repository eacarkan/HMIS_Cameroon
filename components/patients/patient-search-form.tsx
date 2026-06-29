"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Patient search form (Phase 1A Batch 1A). Structured, hospital-scoped lookup: free text
 * (name / patient number) plus phone, identifier, and sex filters. GET form so searches are
 * shareable/bookmarkable; the server component reads the same params.
 */
export type PatientSearchValues = {
  q?: string;
  phone?: string;
  identifier?: string;
  sex?: string;
};

export function PatientSearchForm({ values }: { values: PatientSearchValues }) {
  const t = useTranslations("patient");
  const tSex = useTranslations("sex");

  return (
    <form action="/patients" className="mb-5 grid max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={values.q ?? ""}
          aria-label={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          className="border-input bg-card h-9 w-full rounded-md border py-1.5 pr-3 pl-9 text-sm"
        />
      </div>
      <input
        type="tel"
        name="phone"
        defaultValue={values.phone ?? ""}
        aria-label={t("phoneFilter")}
        placeholder={t("phoneFilter")}
        className="border-input bg-card h-9 w-full rounded-md border px-3 py-1.5 text-sm"
      />
      <input
        type="text"
        name="identifier"
        defaultValue={values.identifier ?? ""}
        aria-label={t("identifierFilter")}
        placeholder={t("identifierFilter")}
        className="border-input bg-card h-9 w-full rounded-md border px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <select
          name="sex"
          defaultValue={values.sex ?? ""}
          aria-label={t("sexFilter")}
          className="border-input bg-card h-9 w-full rounded-md border px-2 text-sm"
        >
          <option value="">{t("sexFilterAll")}</option>
          <option value="female">{tSex("female")}</option>
          <option value="male">{tSex("male")}</option>
        </select>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </div>
    </form>
  );
}
