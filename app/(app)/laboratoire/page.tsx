import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DiagnosticOrderActions } from "@/components/diagnostics/diagnostic-order-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { isDiagnosticModality } from "@/lib/diagnostics";
import { requireActorAndHospital } from "@/server/auth";
import { getDiagnosticWorklist } from "@/server/services";

/** Phase 2I — lab/radiology worklist: active orders awaiting payment, entry or validation. Staff act
 *  inline; the doctor sees results only after validation (enforced in the service). Synthetic data. */
export default async function DiagnosticWorklistPage({
  searchParams,
}: {
  searchParams: Promise<{ modality?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "diagnostic.read")) redirect("/");

  const t = await getTranslations("diagnostic");
  const sp = await searchParams;
  const modality = sp.modality && isDiagnosticModality(sp.modality) ? sp.modality : undefined;
  const orders = await getDiagnosticWorklist(actor, hospital, modality);
  const caps = {
    pay: can(actor.roles, "diagnostic.payment.confirm"),
    enter: can(actor.roles, "diagnostic.result.enter"),
    validate: can(actor.roles, "diagnostic.validate"),
  };

  return (
    <>
      <PageHeader title={t("worklistTitle")} description={t("worklistSubtitle")} />

      <div className="mb-4 flex gap-2 text-sm">
        <FilterLink href="/laboratoire" active={!modality} label={t("filterAll")} />
        <FilterLink href="/laboratoire?modality=lab" active={modality === "lab"} label={t("modality_lab")} />
        <FilterLink href="/laboratoire?modality=radiology" active={modality === "radiology"} label={t("modality_radiology")} />
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">{t("worklistEmpty")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tnum text-muted-foreground text-xs">{o.orderNumber}</span>
                    <Link href={`/encounters/${o.encounterId}`} className="hover:text-primary font-medium">
                      {o.encounter.patient.familyName} {o.encounter.patient.givenName}
                    </Link>
                  </div>
                  <DiagnosticOrderActions
                    order={{
                      id: o.id,
                      encounterId: o.encounterId,
                      orderNumber: o.orderNumber,
                      modality: o.modality as "lab" | "radiology",
                      itemLabel: o.itemLabel,
                      status: o.status as
                        | "requested"
                        | "payment_confirmed"
                        | "in_progress"
                        | "result_entered"
                        | "validated"
                        | "cancelled",
                      isPaid: o.isPaid,
                      priceLabel: formatFcfa(o.price),
                      resultText: o.resultText,
                      cancelReason: o.cancelReason,
                    }}
                    caps={caps}
                    path="/laboratoire"
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1 ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
    >
      {label}
    </Link>
  );
}
