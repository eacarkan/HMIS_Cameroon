import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EncounterForm } from "@/components/encounters/encounter-form";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPatient, listActiveOutpatientConsultationServices } from "@/server/services";

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

  // Phase 2 QA — the outpatient visit form is restricted to ACTIVE OUTPATIENT services that
  // accept consultation (excludes support/cashier/pharmacy/lab/imaging/inpatient). Falls back
  // to the built-in list ONLY when no such service is configured (the form handles the empty
  // case); a valid configured catalogue is never overridden.
  let services: string[] = [];
  try {
    services = (await listActiveOutpatientConsultationServices(actor, hospital)).map(
      (s) => s.nameFr ?? s.name,
    );
  } catch {
    services = [];
  }

  const t = await getTranslations("encounter");

  return (
    <>
      <PatientBanner patient={patient} hospitalName={hospital.name} />
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card className="max-w-2xl">
        <CardContent className="pt-2">
          <EncounterForm patientId={patient.id} services={services} />
        </CardContent>
      </Card>
    </>
  );
}
