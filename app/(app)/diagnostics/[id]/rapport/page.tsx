import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DiagnosticReportView } from "@/components/print/diagnostic-report-view";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getDiagnosticReport } from "@/server/services";

/** Phase 2I — printable lab/radiology report (validated orders only; the service enforces it + audits). */
export default async function DiagnosticReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "diagnostic.read")) redirect("/");
  const { id } = await params;

  const report = await getDiagnosticReport(actor, hospital, id);
  if (!report) notFound();
  const { order, validatorName } = report;

  const t = await getTranslations("diagnostic");

  return (
    <>
      <PageHeader title={t("reportTitle")} description={order.orderNumber} />
      <DiagnosticReportView
        data={{
          orderNumber: order.orderNumber,
          hospitalName: hospital.name,
          patientName: `${order.encounter.patient.familyName} ${order.encounter.patient.givenName}`,
          patientNumber: order.encounter.patient.patientNumber,
          modalityLabel: t(`modality_${order.modality}`),
          examLabel: order.itemLabel,
          resultText: order.resultText ?? "",
          validatorName: validatorName ?? "—",
          dateLabel: formatDateFr(new Date(order.validatedAt ?? order.createdAt)),
        }}
      />
    </>
  );
}
