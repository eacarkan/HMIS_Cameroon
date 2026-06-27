import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { ReceiptView } from "@/components/print/receipt-view";
import { formatDateTimeFr } from "@/lib/dates";
import { requireActorAndHospital } from "@/server/auth";
import { getReceipt } from "@/server/services";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  const payment = await getReceipt(actor, hospital, id);
  if (!payment) notFound();

  const t = await getTranslations("receipt");
  const tMethod = await getTranslations("paymentMethod");
  const patient = payment.invoice.encounter.patient;

  const data = {
    paymentId: payment.id,
    receiptNumber: payment.receiptNumber,
    invoiceNumber: payment.invoice.invoiceNumber,
    patientName: `${patient.givenName} ${patient.familyName}`,
    patientNumber: patient.patientNumber,
    hospitalName: hospital.name,
    items: payment.invoice.items.map((i) => ({
      label: i.label,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    total: payment.invoice.totalAmount,
    amount: payment.amount,
    methodLabel: tMethod(payment.method),
    cashierName: payment.cashier?.displayName ?? "",
    dateLabel: formatDateTimeFr(new Date(payment.paidAt)),
  };

  return (
    <>
      <PageHeader title={t("title")} description={payment.receiptNumber} />
      <ReceiptView data={data} />
    </>
  );
}
