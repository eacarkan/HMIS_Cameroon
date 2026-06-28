import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { InvoiceForm } from "@/components/billing/invoice-form";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getEncounter, listTariffs } from "@/server/services";

export default async function FacturationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  if (!can(actor.roles, "invoice.create")) redirect(`/encounters/${id}`);

  const encounter = await getEncounter(actor, hospital, id);
  if (!encounter) notFound();
  if (encounter.invoices[0]) redirect(`/factures/${encounter.invoices[0].id}`);

  // Active tariffs from the DB catalogue (Gate 3 tariff service, hospital-scoped). The
  // form shows exactly the label/amount that createInvoiceAction will source + snapshot.
  const tariffs = (await listTariffs(actor, hospital))
    .filter((tf) => tf.isActive)
    .map((tf) => ({ code: tf.code, label: tf.label, amount: tf.amount }));

  const t = await getTranslations("billing");

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
          <InvoiceForm encounterId={encounter.id} tariffs={tariffs} />
        </CardContent>
      </Card>
    </>
  );
}
