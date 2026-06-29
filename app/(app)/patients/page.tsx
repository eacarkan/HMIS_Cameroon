import { Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { PatientSearchForm } from "@/components/patients/patient-search-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ageInYears } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { searchPatientsForActor } from "@/server/services";

/**
 * Patient search/list (06 §7, §10; Phase 1A Batch 1A). Search-before-create with structured,
 * hospital-scoped filters (name / patient number, phone, identifier, sex) and a "Créer un
 * patient" action for authorized roles.
 */
export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; phone?: string; identifier?: string; sex?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { q, phone, identifier, sex } = await searchParams;
  const sexFilter: "male" | "female" | undefined =
    sex === "male" || sex === "female" ? sex : undefined;
  const filters = {
    query: (q ?? "").trim(),
    phone: (phone ?? "").trim(),
    identifier: (identifier ?? "").trim(),
    sex: sexFilter,
  };
  const hasFilters = Boolean(filters.query || filters.phone || filters.identifier || filters.sex);
  const patients = await searchPatientsForActor(actor, hospital, filters);

  const t = await getTranslations("patient");
  const tSex = await getTranslations("sex");
  const canCreate = can(actor.roles, "patient.create");

  const createButton = canCreate ? (
    <Button asChild>
      <Link href="/patients/nouveau">
        <Plus className="size-4" aria-hidden />
        {t("create")}
      </Link>
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader title={t("title")} actions={createButton} />

      <PatientSearchForm values={{ q, phone, identifier, sex }} />

      {patients.length === 0 ? (
        <Card className="border border-dashed bg-transparent ring-0">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="bg-accent text-primary grid size-12 place-items-center rounded-full">
              <UserPlus className="size-6" aria-hidden />
            </span>
            <p className="text-muted-foreground max-w-sm text-sm">
              {hasFilters ? t("noMatch") : t("noResults")}
            </p>
            {createButton}
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card ring-foreground/5 overflow-hidden rounded-xl ring-1">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("colName")}</th>
                <th className="px-4 py-2.5 font-medium">{t("colNumber")}</th>
                <th className="px-4 py-2.5 font-medium">{t("colAgeSex")}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {p.givenName} {p.familyName}
                  </td>
                  <td className="tnum text-muted-foreground px-4 py-2.5">
                    {p.patientNumber}
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {ageInYears(new Date(p.dateOfBirth))} {t("years")} ·{" "}
                    {tSex(p.sex)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/patients/${p.id}`}>{t("open")}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
