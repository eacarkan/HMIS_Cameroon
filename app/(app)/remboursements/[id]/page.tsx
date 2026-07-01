import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { RefundActions } from "@/components/billing/refund-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getRefund } from "@/server/services";

/** Phase 2C — refund voucher detail + lifecycle actions (admin approves/cancels; cashier executes). */
export default async function RefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "refund.read")) redirect("/");
  const { id } = await params;
  const voucher = await getRefund(actor, hospital, id);
  if (!voucher) notFound();

  const t = await getTranslations("refund");
  const patient = voucher.invoice.encounter.patient;
  const statusLabel = t(voucher.status as "requested" | "approved" | "paid" | "cancelled");

  return (
    <>
      <PageHeader
        title={voucher.voucherNumber}
        description={t("documentTitle")}
        actions={<Badge variant="secondary">{statusLabel}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("documentTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t("amount")} value={formatFcfa(voucher.amount)} strong />
            <Row
              label={t("invoice")}
              value={voucher.invoice.invoiceNumber}
              href={`/factures/${voucher.invoiceId}`}
            />
            <Row label={t("patient")} value={`${patient.givenName} ${patient.familyName}`} />
            <Row label={t("reason")} value={voucher.reason} />
            <Row label={t("requestedBy")} value={voucher.requestedBy.displayName} />
            {voucher.approvedBy ? (
              <Row label={t("approvedBy")} value={voucher.approvedBy.displayName} />
            ) : null}
            {voucher.executedBy ? (
              <Row label={t("executedBy")} value={voucher.executedBy.displayName} />
            ) : null}
            {voucher.cancelledBy ? (
              <Row label={t("cancelledBy")} value={voucher.cancelledBy.displayName} />
            ) : null}
            <Row label={t("date")} value={formatDateTimeFr(new Date(voucher.createdAt))} />
            <div className="mt-8 flex justify-end">
              <div className="w-56 border-t pt-1 text-center text-xs">{t("signature")}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RefundActions
              id={voucher.id}
              status={voucher.status}
              canApprove={can(actor.roles, "invoice.cancel.approve")}
              canExecute={can(actor.roles, "refund.execute")}
            />
            <Button asChild variant="ghost" size="sm">
              <Link href="/remboursements">{t("back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  href,
  strong,
}: {
  label: string;
  value: string;
  href?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "text-base font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      {href ? (
        <Link href={href} className="hover:text-primary tnum font-medium">
          {value}
        </Link>
      ) : (
        <span className="tnum text-right">{value}</span>
      )}
    </div>
  );
}
