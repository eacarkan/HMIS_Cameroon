import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EncounterForm } from "@/components/encounters/encounter-form";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPatient } from "@/server/services";

export default async function NewEncounterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  if (!can(actor.roles, "encounter.create")) redirect(`/patients/${id}`);

  const patient = await getPatient(actor, hospital, id);
  if (!patient) notFound();

  const t = await getTranslations("encounter");

  return (
    <>
      <PatientBanner patient={patient} hospitalName={hospital.name} />
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card className="max-w-2xl">
        <CardContent className="pt-2">
          <EncounterForm patientId={patient.id} />
        </CardContent>
      </Card>
    </>
  );
}
