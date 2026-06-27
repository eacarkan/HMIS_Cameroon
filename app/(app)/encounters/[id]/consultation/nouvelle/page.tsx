import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ConsultationForm } from "@/components/consultations/consultation-form";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getEncounter } from "@/server/services";

export default async function NewConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  if (!can(actor.roles, "consultation.create")) redirect(`/encounters/${id}`);

  const encounter = await getEncounter(actor, hospital, id);
  if (!encounter) notFound();

  const t = await getTranslations("consultation");

  return (
    <>
      <PatientBanner
        patient={encounter.patient}
        hospitalName={hospital.name}
        activeEncounter={{
          encounterNumber: encounter.encounterNumber,
          status: encounter.status,
        }}
      />
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card className="max-w-3xl">
        <CardContent className="pt-2">
          <ConsultationForm
            encounterId={encounter.id}
            defaultReason={encounter.reason}
          />
        </CardContent>
      </Card>
    </>
  );
}
