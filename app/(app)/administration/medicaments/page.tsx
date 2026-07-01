import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreateMedicationForm,
  DeactivateMedicationButton,
  ReactivateMedicationButton,
} from "@/components/admin/medication-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listMedicationCatalogue } from "@/server/services";

/** Phase 2D-1 — medication catalogue administration (Hospital Admin). Hospital-scoped. */
export default async function MedicationsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "medication.manage")) redirect("/");

  const medications = await listMedicationCatalogue(actor, hospital);
  const t = await getTranslations("medication");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/administration">{t("backToAdmin")}</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <CreateMedicationForm />
        </CardHeader>
        <CardContent>
          {medications.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noMedications")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t("code")}</th>
                  <th className="py-2 pr-4 font-medium">{t("nameFr")}</th>
                  <th className="py-2 pr-4 font-medium">{t("form")}</th>
                  <th className="py-2 pr-4 font-medium">{t("unit")}</th>
                  <th className="py-2 pr-4 font-medium">{t("strength")}</th>
                  <th className="py-2 pr-4 font-medium">{t("status")}</th>
                  <th className="py-2 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {medications.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="tnum py-2 pr-4">{m.code}</td>
                    <td className="py-2 pr-4">{m.nameFr}</td>
                    <td className="py-2 pr-4">{m.form}</td>
                    <td className="py-2 pr-4">{m.unit}</td>
                    <td className="text-muted-foreground py-2 pr-4">{m.strength ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={m.isActive ? "default" : "secondary"}>
                        {m.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {m.isActive ? (
                        <DeactivateMedicationButton id={m.id} />
                      ) : (
                        <ReactivateMedicationButton id={m.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
