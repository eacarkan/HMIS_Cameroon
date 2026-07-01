import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DecideAdjustmentForms } from "@/components/pharmacy/adjustment-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listStockAdjustmentsForActor } from "@/server/services";

/** Phase 2D-7 — stock-adjustment worklist. Pharmacy + oversight read it; the Pharmacist-in-Charge decides. */
export default async function StockAdjustmentsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "stock.read")) redirect("/");

  const adjustments = await listStockAdjustmentsForActor(actor, hospital);
  const t = await getTranslations("stockAdjustment");
  const canDecide = can(actor.roles, "stock.adjustment.approve");

  const statusLabel = (s: string) =>
    s === "requested" ? t("pending") : s === "approved" ? t("approved_status") : t("rejected_status");
  const statusVariant = (s: string) =>
    s === "approved" ? ("default" as const) : s === "rejected" ? ("destructive" as const) : ("secondary" as const);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {adjustments.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-5">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {a.medication.nameFr} · {a.batch.batchNumber}
                    </span>
                    <Badge variant="outline">
                      {t(`type_${a.type}`)} {a.quantity}
                    </Badge>
                    <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t("requestedBy")}: {a.requestedBy.displayName} ·{" "}
                    {formatDateTimeFr(new Date(a.createdAt))}
                  </p>
                  <p className="text-xs">
                    {t("reason")}: {a.reason}
                  </p>
                  {a.decisionReason ? (
                    <p className="text-muted-foreground text-xs">
                      {t("decisionReason")}: {a.decisionReason}
                    </p>
                  ) : null}
                </div>
                {canDecide && a.status === "requested" ? (
                  <DecideAdjustmentForms adjustmentId={a.id} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
