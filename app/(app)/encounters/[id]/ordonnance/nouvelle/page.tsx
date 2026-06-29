import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { PrescriptionEditor } from "@/components/prescriptions/prescription-editor";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getEncounter, listActiveMedications } from "@/server/services";

/** Phase 2D-2 — doctor writes a prescription for an encounter (no stock effect). */
export default async function NewPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  if (!can(actor.roles, "prescription.create")) redirect(`/encounters/${id}`);

  const encounter = await getEncounter(actor, hospital, id);
  if (!encounter) notFound();

  const medications = (await listActiveMedications(actor, hospital)).map((m) => ({
    id: m.id,
    label: m.strength ? `${m.nameFr} ${m.strength}` : m.nameFr,
  }));
  const t = await getTranslations("prescription");

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
      <Card className="max-w-5xl">
        <CardContent className="pt-4">
          {medications.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noMedications")}</p>
          ) : (
            <PrescriptionEditor encounterId={encounter.id} medications={medications} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
