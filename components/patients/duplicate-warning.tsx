"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PatientDuplicateView } from "@/server/actions/patient-actions";

/**
 * Possible-duplicate warning shown at registration (Phase 1A Batch 1A). Presentational only:
 * it surfaces likely-duplicate existing patients and lets the user open a record. It NEVER
 * merges, blocks, or decides identity — the parent form provides the "create anyway" control.
 */
export function DuplicateWarning({ candidates }: { candidates: PatientDuplicateView[] }) {
  const t = useTranslations("patient");
  if (candidates.length === 0) return null;

  return (
    <div
      role="alert"
      className="border-amber-300 bg-amber-50 text-amber-900 space-y-3 rounded-md border p-4 text-sm"
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" aria-hidden />
        {t("duplicateWarningTitle")}
      </div>
      <p className="text-amber-800">{t("duplicateWarningBody")}</p>
      <ul className="divide-y divide-amber-200">
        {candidates.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="font-medium">{c.fullName}</span>{" "}
              <span className="tnum text-amber-700">· {c.patientNumber}</span>{" "}
              <span className="text-amber-700">
                ({t(c.basis === "name_dob" ? "duplicateBasisNameDob" : "duplicateBasisPhone")})
              </span>
            </span>
            <Link
              href={`/patients/${c.id}`}
              className="font-medium underline underline-offset-2"
            >
              {t("open")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
