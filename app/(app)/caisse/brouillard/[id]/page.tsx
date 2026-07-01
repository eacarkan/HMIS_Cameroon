import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CorrectShiftForm } from "@/components/billing/brouillard-controls";
import { PageHeader } from "@/components/layout/page-header";
import { BrouillardView } from "@/components/print/brouillard-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getCashierShift, previewShiftTotals } from "@/server/services";

/** Phase 2C — printable Brouillard de Caisse + controlled correction (frozen figures unchanged). */
export default async function BrouillardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "cashier.report.read")) redirect("/");
  const { id } = await params;
  const shift = await getCashierShift(actor, hospital, id);
  if (!shift) notFound();

  const t = await getTranslations("brouillard");
  const statusLabel =
    shift.status === "open"
      ? t("statusOpen")
      : shift.status === "closed"
        ? t("statusClosed")
        : t("statusCorrected");

  // An OPEN shift's figures are not frozen yet — show live totals; a closed one shows the frozen set.
  const live = shift.status === "open" ? await previewShiftTotals(actor, hospital, id) : null;
  const totals = live ?? {
    totalCashReceived: shift.totalCashReceived,
    totalMobileCardReceived: shift.totalMobileCardReceived,
    totalCancellationsRefunds: shift.totalCancellationsRefunds,
    expectedClosingBalance: shift.expectedClosingBalance,
    receiptCount: shift.receiptCount,
  };

  const data = {
    shiftNumber: shift.shiftNumber,
    hospitalName: hospital.name,
    cashierName: shift.cashier.displayName,
    statusLabel,
    openedAtLabel: formatDateTimeFr(new Date(shift.openedAt)),
    closedAtLabel: shift.closedAt ? formatDateTimeFr(new Date(shift.closedAt)) : null,
    openingBalance: shift.openingBalance,
    totalCashReceived: totals.totalCashReceived,
    totalMobileCardReceived: totals.totalMobileCardReceived,
    totalCancellationsRefunds: totals.totalCancellationsRefunds,
    expectedClosingBalance: totals.expectedClosingBalance,
    receiptCount: totals.receiptCount,
    corrections: shift.corrections.map((c) => ({
      reason: c.reason,
      note: c.note,
      correctedByName: c.correctedBy.displayName,
      dateLabel: formatDateTimeFr(new Date(c.createdAt)),
    })),
  };

  const canCorrect = shift.status !== "open" && can(actor.roles, "cashier.shift.manage");

  return (
    <>
      <PageHeader title={shift.shiftNumber} description={t("documentTitle")} />
      <BrouillardView data={data} />
      {canCorrect ? (
        <Card className="mt-6 max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("correctTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrectShiftForm shiftId={shift.id} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
