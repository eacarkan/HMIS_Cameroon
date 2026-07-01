import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DecideCancellationForms } from "@/components/billing/cancellation-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listCancellations } from "@/server/services";

/**
 * Phase 2C — invoice cancellation worklist (Hospital Administrator). The admin approves/rejects
 * pending requests; the cashier (requester) cannot approve their own. Hospital-scoped.
 */
export default async function CancellationsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "invoice.cancel.approve")) redirect("/");

  const requests = await listCancellations(actor, hospital);
  const t = await getTranslations("cancellation");

  const statusLabel = (s: string) =>
    s === "requested" ? t("pending") : s === "approved" ? t("approved") : t("rejected");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noRequests")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const patient = r.invoice.encounter.patient;
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/factures/${r.invoiceId}`}
                        className="hover:text-primary font-medium"
                      >
                        {r.invoice.invoiceNumber}
                      </Link>
                      <Badge variant="secondary">{statusLabel(r.status)}</Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("patient")}: {patient.givenName} {patient.familyName} · {t("amount")}:{" "}
                      {formatFcfa(r.invoice.totalAmount)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("requestedBy")}: {r.requestedBy.displayName} ·{" "}
                      {formatDateTimeFr(new Date(r.createdAt))}
                    </p>
                    <p className="text-xs">
                      {t("reason")}: {r.reason}
                    </p>
                    {r.decisionReason ? (
                      <p className="text-muted-foreground text-xs">
                        {t("decisionReason")}: {r.decisionReason}
                      </p>
                    ) : null}
                    {r.refundVoucher ? (
                      <Link
                        href={`/remboursements/${r.refundVoucher.id}`}
                        className="text-xs underline"
                      >
                        {t("viewRefund")} — {r.refundVoucher.voucherNumber}
                      </Link>
                    ) : null}
                  </div>
                  {r.status === "requested" ? <DecideCancellationForms requestId={r.id} /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
