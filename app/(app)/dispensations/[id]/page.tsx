import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { DispenseView } from "@/components/print/dispense-view";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getDispenseRecord } from "@/server/services";

/** Phase 2D-5 — printable dispense record. */
export default async function DispenseRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  // A dispense record exposes batch-level pharmacy decisions — pharmacy + oversight (`dispense.read`).
  if (!can(actor.roles, "dispense.read")) redirect("/");
  const { id } = await params;
  const record = await getDispenseRecord(actor, hospital, id);
  if (!record) notFound();

  const t = await getTranslations("dispense");
  const patient = record.prescription.patient;
  const data = {
    dispenseNumber: record.dispenseNumber,
    prescriptionNumber: record.prescription.prescriptionNumber,
    hospitalName: hospital.name,
    patientName: `${patient.givenName} ${patient.familyName}`,
    pharmacistName: record.dispensedBy.displayName,
    dateLabel: formatDateTimeFr(new Date(record.createdAt)),
    items: record.items.map((it) => ({
      medicationLabel: it.medicationLabel,
      unit: it.unit,
      quantity: it.quantity,
      batchNumber: it.batch.batchNumber,
    })),
  };

  return (
    <>
      <PageHeader title={record.dispenseNumber} description={t("documentTitle")} />
      <DispenseView data={data} />
    </>
  );
}
