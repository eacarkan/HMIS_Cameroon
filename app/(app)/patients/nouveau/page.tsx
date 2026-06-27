import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { PatientForm } from "@/components/patients/patient-form";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";

export default async function NouveauPatientPage() {
  const { actor } = await requireActorAndHospital();
  if (!can(actor.roles, "patient.create")) redirect("/patients");

  const t = await getTranslations("patient");

  return (
    <>
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card className="max-w-3xl">
        <CardContent className="pt-2">
          <PatientForm />
        </CardContent>
      </Card>
    </>
  );
}
