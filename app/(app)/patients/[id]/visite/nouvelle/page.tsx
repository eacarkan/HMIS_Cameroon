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

  // Phase 2 QA (follow-up) — the server (openEncounter) is the source of truth and enforces
  // OUTPATIENT + acceptsConsultation. This page only surfaces the configured outpatient
  // consultation services for that hospital. It deliberately does NOT swallow auth/DB errors into
  // a fallback list: any error here propagates to the route error boundary (a controlled error
  // state). When NO outpatient consultation service is configured, visit creation is blocked with
  // a configuration message instead of offering an unusable hardcoded list.
  const services = (await listActiveOutpatientConsultationServices(actor, hospital)).map(
    (s) => s.nameFr ?? s.name,
  );

  const t = await getTranslations("encounter");

  return (
    <>
      <PatientBanner patient={patient} hospitalName={hospital.name} />
      <PageHeader title={t("newTitle")} description={t("newSubtitle")} />
      <Card className="max-w-2xl">
        <CardContent className="pt-2">
          {services.length > 0 ? (
            <EncounterForm patientId={patient.id} services={services} />
          ) : (
            <p className="text-muted-foreground text-sm">{t("noOutpatientService")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
