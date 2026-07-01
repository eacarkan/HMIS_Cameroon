import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DispenseButton } from "@/components/pharmacy/dispense-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPharmacyWorklist } from "@/server/services";

/** Phase 2D-5 — pharmacy dispensing worklist (prescriptions sent to the pharmacy). */
export default async function DispensationPage() {
  const { actor, hospital } = await requireActorAndHospital();
  // The dispensing worklist is an OPERATIONAL pharmacy queue — pharmacy only (matches the nav gate).
  if (!can(actor.roles, "dispense.perform")) redirect("/");

  const worklist = await getPharmacyWorklist(actor, hospital);
  const t = await getTranslations("dispense");
  const tps = await getTranslations("prescriptionStatus");
  const canDispense = can(actor.roles, "dispense.perform");

  return (
    <>
      <PageHeader title={t("worklistTitle")} description={t("worklistSubtitle")} />
      {worklist.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("worklistEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {worklist.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/ordonnances/${p.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {p.prescriptionNumber}
                    </Link>
                    <Badge variant="secondary">{tps(p.status)}</Badge>
                    {p.isPaid ? (
                      <Badge>{t("paid")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("unpaid")}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {p.patient.givenName} {p.patient.familyName} · {p.items.length} {t("lines")} ·{" "}
                    {p.prescribedBy.displayName}
                  </p>
                </div>
                {canDispense && p.isPaid ? (
                  <DispenseButton prescriptionId={p.id} />
                ) : !p.isPaid ? (
                  <span className="text-muted-foreground text-xs">{t("awaitingPayment")}</span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
