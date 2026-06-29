import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { TemporaryPatientForm } from "@/components/patients/temporary-patient-form";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";

/** Temporary / unidentified-patient registration (Phase 2B). Reception only (patient.create). */
export default async function TemporaryPatientPage() {
  const { actor } = await requireActorAndHospital();
  if (!can(actor.roles, "patient.create")) redirect("/patients");

  const t = await getTranslations("patient");
  return (
    <>
      <PageHeader title={t("temporaryTitle")} description={t("temporarySubtitle")} />
      <Card className="max-w-2xl">
        <CardContent className="pt-2">
          <TemporaryPatientForm />
        </CardContent>
      </Card>
    </>
  );
}
