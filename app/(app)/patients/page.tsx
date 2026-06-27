import { Plus, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ageInYears } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { searchPatientsForActor } from "@/server/services";

/**
 * Patient search/list (06 §7, §10). Search-before-create: a prominent search box,
 * results, and a "Créer un patient" action available to authorized roles.
 */
export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const patients = await searchPatientsForActor(actor, hospital, query);

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

      <form action="/patients" className="mb-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            className="border-input bg-card h-9 w-full rounded-md border py-1.5 pr-3 pl-9 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t("search")}
        </Button>
      </form>

      {patients.length === 0 ? (
        <Card className="border border-dashed bg-transparent ring-0">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="bg-accent text-primary grid size-12 place-items-center rounded-full">
              <UserPlus className="size-6" aria-hidden />
            </span>
            <p className="text-muted-foreground max-w-sm text-sm">
              {query ? t("noMatch") : t("noResults")}
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
