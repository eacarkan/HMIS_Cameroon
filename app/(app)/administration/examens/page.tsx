import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DiagnosticCatalogueAdmin } from "@/components/diagnostics/diagnostic-catalogue-admin";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listDiagnosticCatalogueAll } from "@/server/services";

/** Phase 2I — admin maintenance of the lab/radiology catalogue (hospital-scoped). */
export default async function DiagnosticCataloguePage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "diagnostic.catalogue.manage")) redirect("/");

  const t = await getTranslations("diagnostic");
  const items = (await listDiagnosticCatalogueAll(actor, hospital)).map((i) => ({
    id: i.id,
    code: i.code,
    nameFr: i.nameFr,
    modality: i.modality as "lab" | "radiology",
    priceLabel: formatFcfa(i.price),
    isActive: i.isActive,
  }));

  return (
    <>
      <PageHeader title={t("catalogueTitle")} description={t("catalogueSubtitle")} />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <DiagnosticCatalogueAdmin items={items} />
        </CardContent>
      </Card>
    </>
  );
}
