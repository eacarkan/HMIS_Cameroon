import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ImportForm, ReviewForm } from "@/components/admin/external-result-import";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getExternalResultQueue } from "@/server/services";

/**
 * Phase 4C — external lab/radiology result import. Imported results are STAGING records: matched with
 * warnings only, routed to a review queue, and promoted into the clinical record ONLY by an authorized
 * reviewer (≠ the importer) via the existing Phase 2I path — and even then hidden from the doctor until
 * a separate validator validates. No analyzer/PACS/DICOM. Hospital-scoped; RBAC server-authoritative.
 */
export default async function ExternalResultImportPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  const canImport = can(rolesHere, "external_result.import");
  const canReview = can(rolesHere, "external_result.review");
  if (!canImport && !canReview) redirect("/");

  const t = await getTranslations("externalResult");
  const { items } = await getExternalResultQueue(actor, hospital);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-amber-500/40 bg-amber-500/10 -mt-2 mb-4 rounded-md border px-3 py-2 text-xs">
        <strong>{t("notClinicalNotice")}</strong>
      </div>

      {canImport ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("import")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queue")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {items.length === 0 ? <p className="text-muted-foreground text-sm">{t("empty")}</p> : null}
          {items.map((it) => (
            <div key={it.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {it.testCode} ({it.modality}){" "}
                  <span className="text-muted-foreground text-xs">
                    {it.source} · patient {it.patientRef}
                    {it.orderRef ? ` · commande ${it.orderRef}` : ""}
                  </span>
                </span>
                <Badge variant={it.status === "PROMOTED" ? "secondary" : it.status === "NEEDS_REVIEW" ? "outline" : "destructive"}>
                  {t(`statuses.${it.status}`)}
                </Badge>
              </div>
              {it.matchWarning ? <p className="text-amber-700 mt-1 text-xs">⚠ {it.matchWarning}</p> : null}
              {canReview && it.status === "NEEDS_REVIEW" ? (
                <div className="mt-2 border-t pt-2">
                  <ReviewForm id={it.id} canPromote={Boolean(it.matchedOrderId)} />
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
