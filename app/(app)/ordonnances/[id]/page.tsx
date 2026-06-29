import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { PrescriptionLifecycle } from "@/components/prescriptions/prescription-lifecycle";
import { PrescriptionView } from "@/components/print/prescription-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPrescription } from "@/server/services";

/** Phase 2D-2 — printable prescription + lifecycle (doctor). */
export default async function PrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "prescription.read")) redirect("/");
  const { id } = await params;
  const presc = await getPrescription(actor, hospital, id);
  if (!presc) notFound();

  const t = await getTranslations("prescription");
  const tStatus = await getTranslations("prescriptionStatus");
  const statusLabel = tStatus(presc.status);

  const data = {
    prescriptionNumber: presc.prescriptionNumber,
    hospitalName: hospital.name,
    patientName: `${presc.patient.givenName} ${presc.patient.familyName}`,
    patientNumber: presc.patient.patientNumber,
    doctorName: presc.prescribedBy.displayName,
    statusLabel,
    dateLabel: formatDateTimeFr(new Date(presc.createdAt)),
    notes: presc.notes,
    items: presc.items.map((it) => ({
      medicationLabel: it.medicationLabel,
      unit: it.unit,
      dosage: it.dosage,
      frequency: it.frequency,
      duration: it.duration,
      quantity: it.quantity,
      instructions: it.instructions,
    })),
  };
  const canManage = can(actor.roles, "prescription.create");

  return (
    <>
      <PageHeader
        title={presc.prescriptionNumber}
        description={t("documentTitle")}
        actions={<Badge variant="secondary">{statusLabel}</Badge>}
      />
      {canManage ? (
        <Card className="mb-4 max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("lifecycle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PrescriptionLifecycle id={presc.id} status={presc.status} />
          </CardContent>
        </Card>
      ) : null}
      <PrescriptionView data={data} />
    </>
  );
}
