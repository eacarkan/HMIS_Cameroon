import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmPaymentButton } from "@/components/pharmacy/dispense-controls";
import { PrescriptionLifecycle } from "@/components/prescriptions/prescription-lifecycle";
import { PrescriptionView } from "@/components/print/prescription-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPrescription, listDispensesForPrescription } from "@/server/services";

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
  const td = await getTranslations("dispense");
  const statusLabel = tStatus(presc.status);
  // Dispense records are a pharmacy/oversight view (`dispense.read`); the doctor/cashier viewing this
  // prescription do not see the batch-level records (they see the prescription status itself).
  const dispenses = can(actor.roles, "dispense.read")
    ? await listDispensesForPrescription(actor, hospital, id)
    : [];
  const canConfirmPayment =
    can(actor.roles, "prescription.payment.confirm") &&
    !presc.isPaid &&
    presc.status !== "draft" &&
    presc.status !== "cancelled";

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
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("lifecycle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PrescriptionLifecycle id={presc.id} status={presc.status} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{td("pharmacyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {td("paymentStatus")}:{" "}
              <Badge variant={presc.isPaid ? "default" : "outline"}>
                {presc.isPaid ? td("paid") : td("unpaid")}
              </Badge>
            </p>
            {canConfirmPayment ? <ConfirmPaymentButton prescriptionId={presc.id} /> : null}
            {dispenses.length > 0 ? (
              <div className="border-t pt-2">
                <p className="text-muted-foreground text-xs">{td("records")}</p>
                <ul className="mt-1 space-y-1">
                  {dispenses.map((d) => (
                    <li key={d.id}>
                      <Link href={`/dispensations/${d.id}`} className="hover:text-primary underline">
                        {d.dispenseNumber}
                      </Link>{" "}
                      <span className="text-muted-foreground text-xs">
                        {formatDateTimeFr(new Date(d.createdAt))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <PrescriptionView data={data} />
    </>
  );
}
