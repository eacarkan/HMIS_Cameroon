import { ReceiptText, Stethoscope } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ClinicalStructurePanel } from "@/components/consultations/clinical-structure-panel";
import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getEncounter, listObservations, listDiagnoses } from "@/server/services";

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  const encounter = await getEncounter(actor, hospital, id);
  if (!encounter) notFound();

  const t = await getTranslations("encounter");
  const tEnc = await getTranslations("encounterStatus");
  const tCons = await getTranslations("consultationStatus");
  const tInv = await getTranslations("invoiceStatus");

  const invoice = encounter.invoices[0] ?? null;
  const clinician =
    encounter.assignedTo?.displayName ??
    encounter.consultations[0]?.performedBy?.displayName ??
    t("unassigned");

  // Structured clinical data (Gate 4): clinician reads/manages; others don't see it.
  const canReadClinical = can(actor.roles, "clinical.structure.read");
  const canManageClinical = can(actor.roles, "clinical.structure.manage");
  const clinicalByConsultation = new Map<
    string,
    {
      observations: Awaited<ReturnType<typeof listObservations>>;
      diagnoses: Awaited<ReturnType<typeof listDiagnoses>>;
    }
  >();
  if (canReadClinical) {
    await Promise.all(
      encounter.consultations.map(async (c) => {
        const [observations, diagnoses] = await Promise.all([
          listObservations(actor, hospital, c.id),
          listDiagnoses(actor, hospital, c.id),
        ]);
        clinicalByConsultation.set(c.id, { observations, diagnoses });
      }),
    );
  }

  return (
    <>
      <PatientBanner
        patient={encounter.patient}
        hospitalName={hospital.name}
        activeEncounter={{
          encounterNumber: encounter.encounterNumber,
          status: encounter.status,
        }}
      />
      <PageHeader
        title={encounter.encounterNumber}
        description={encounter.serviceLabel}
        actions={<Badge variant="secondary">{tEnc(encounter.status)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label={t("openedAt")}
              value={formatDateTimeFr(new Date(encounter.openedAt))}
            />
            <Row label={t("clinician")} value={clinician} />
            <div>
              <div className="text-muted-foreground">{t("reason")}</div>
              <div className="font-medium">{encounter.reason}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("consultations")}</CardTitle>
            {can(actor.roles, "consultation.create") &&
            encounter.consultations.length === 0 ? (
              <CardAction>
                <Button asChild size="sm">
                  <Link
                    href={`/encounters/${encounter.id}/consultation/nouvelle`}
                  >
                    <Stethoscope className="size-4" aria-hidden />
                    {t("recordConsultation")}
                  </Link>
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {encounter.consultations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("noConsultations")}
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {encounter.consultations.map((c) => (
                  <li key={c.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{c.reason}</span>
                      <Badge variant="secondary">{tCons(c.status)}</Badge>
                    </div>
                    {c.clinicalNote ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {c.clinicalNote}
                      </p>
                    ) : null}
                    {c.performedBy ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {c.performedBy.displayName}
                      </p>
                    ) : null}
                    {canReadClinical ? (
                      <ClinicalStructurePanel
                        encounterId={encounter.id}
                        consultationId={c.id}
                        canManage={canManageClinical}
                        observations={(
                          clinicalByConsultation.get(c.id)?.observations ?? []
                        ).map((o) => ({
                          id: o.id,
                          type: o.type,
                          value: o.value,
                          unit: o.unit,
                        }))}
                        diagnoses={(
                          clinicalByConsultation.get(c.id)?.diagnoses ?? []
                        ).map((d) => ({
                          id: d.id,
                          label: d.label,
                          code: d.code,
                          isPrimary: d.isPrimary,
                        }))}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("billing")}</CardTitle>
            {!invoice && can(actor.roles, "invoice.create") ? (
              <CardAction>
                <Button asChild size="sm">
                  <Link href={`/encounters/${encounter.id}/facturation`}>
                    <ReceiptText className="size-4" aria-hidden />
                    {t("createInvoice")}
                  </Link>
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {!invoice ? (
              <p className="text-muted-foreground text-sm">{t("noInvoice")}</p>
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/factures/${invoice.id}`}
                  className="hover:text-primary tnum font-medium"
                >
                  {invoice.invoiceNumber}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="tnum">
                    {formatFcfa(invoice.totalAmount)}
                  </span>
                  <Badge variant="secondary">{tInv(invoice.status)}</Badge>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/factures/${invoice.id}`}>
                      {t("viewInvoice")}
                    </Link>
                  </Button>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
