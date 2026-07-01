import { ReceiptText, Stethoscope } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ClinicalStructurePanel } from "@/components/consultations/clinical-structure-panel";
import { EmergencyControls } from "@/components/emergency/emergency-controls";
import { AdmissionControls } from "@/components/hospitalization/admission-controls";
import { DiagnosticPanel } from "@/components/diagnostics/diagnostic-panel";
import {
  EncounterServiceForm,
  EncounterStatusControls,
} from "@/components/encounters/encounter-lifecycle";
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
import {
  getAdmissionForEncounter,
  getEmergencyDebtSummary,
  getEncounter,
  getEncounterStatusHistory,
  listActiveInpatientWardServices,
  listActiveOutpatientConsultationServices,
  listDiagnosisCodes,
  listDiagnosticsForEncounter,
  listObservations,
  listDiagnoses,
  listOrderableDiagnostics,
  listPrescriptionsForEncounter,
} from "@/server/services";

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
  const tPresc = await getTranslations("prescription");
  const tPrescStatus = await getTranslations("prescriptionStatus");
  const tEm = await getTranslations("emergency");
  const tAdm = await getTranslations("admission");
  const tDiag = await getTranslations("diagnostic");

  // Phase 2H — emergency exception + emergency-debt ledger (clinical/financial/oversight read).
  const canReadEmergency = can(actor.roles, "emergency.debt.read");
  const emergency = canReadEmergency ? await getEmergencyDebtSummary(actor, hospital, id) : null;
  const emergencyCaps = {
    flag: can(actor.roles, "emergency.flag"),
    accrue: can(actor.roles, "emergency.debt.accrue"),
    settle: can(actor.roles, "emergency.debt.settle"),
    waive: can(actor.roles, "emergency.debt.waive"),
  };

  // Phase 2G — ward-level hospitalization (admission + daily ward fee + discharge gate).
  const canReadAdmission = can(actor.roles, "admission.read");
  const admissionData = canReadAdmission ? await getAdmissionForEncounter(actor, hospital, id) : null;
  const admissionCaps = {
    request: can(actor.roles, "admission.request"),
    assign: can(actor.roles, "admission.assign"),
    discharge: can(actor.roles, "admission.discharge"),
    fee: can(actor.roles, "admission.fee.charge"),
  };
  const wards = admissionCaps.assign
    ? (await listActiveInpatientWardServices(actor, hospital)).map((w) => ({
        id: w.id,
        name: w.nameFr ?? w.name ?? w.code,
      }))
    : [];
  // Phase 2I — manual lab & radiology (results hidden from the doctor until validated, server-enforced).
  const canReadDiagnostic = can(actor.roles, "diagnostic.read");
  const canRequestDiagnostic = can(actor.roles, "diagnostic.request");
  const diagnosticOrders = canReadDiagnostic
    ? (await listDiagnosticsForEncounter(actor, hospital, id)).map((o) => ({
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
      }))
    : [];
  const diagnosticCatalogue = canRequestDiagnostic
    ? (await listOrderableDiagnostics(actor, hospital)).map((c) => ({
        id: c.id,
        label: `${c.nameFr} — ${formatFcfa(c.price)} (${c.modality === "lab" ? "Labo" : "Imagerie"})`,
      }))
    : [];
  const diagnosticCaps = {
    pay: can(actor.roles, "diagnostic.payment.confirm"),
    enter: can(actor.roles, "diagnostic.result.enter"),
    validate: can(actor.roles, "diagnostic.validate"),
  };

  const adm = admissionData?.admission ?? null;
  const admissionView = adm
    ? {
        id: adm.id,
        admissionNumber: adm.admissionNumber,
        status: adm.status,
        reason: adm.reason,
        wardName: adm.wardService?.nameFr ?? adm.wardService?.name ?? null,
        dailyWardFeeLabel: adm.dailyWardFee > 0 ? formatFcfa(adm.dailyWardFee) : null,
        invoiceId: adm.invoice?.id ?? null,
        invoiceNumber: adm.invoice?.invoiceNumber ?? null,
        invoiceTotalLabel: adm.invoice ? formatFcfa(adm.invoice.totalAmount) : null,
        dailyChargeCount: adm.dailyCharges.length,
        cancelReason: adm.cancelReason,
      }
    : null;

  const invoice = encounter.invoices[0] ?? null;
  const clinician =
    encounter.assignedTo?.displayName ??
    encounter.consultations[0]?.performedBy?.displayName ??
    t("unassigned");

  // Lifecycle (Batch 1B): status controls/assignment for encounter managers; status history
  // (composed from append-only audit) is readable with encounter.read.
  const canManageEncounter = can(actor.roles, "encounter.create");
  const statusHistory = await getEncounterStatusHistory(actor, hospital, id);
  // Phase 2 QA (follow-up) — the re-assignment control offers only active outpatient consultation
  // services (same restriction as the new-visit form); the server enforces the same rule.
  const serviceOptions = canManageEncounter
    ? (await listActiveOutpatientConsultationServices(actor, hospital)).map(
        (s) => s.nameFr ?? s.name,
      )
    : [];

  // Structured clinical data (Gate 4): clinician reads/manages; others don't see it.
  const canReadClinical = can(actor.roles, "clinical.structure.read");
  // Phase 2B — the configurable ICD-10 subset offered as a diagnosis picker.
  const diagnosisCodes = canReadClinical
    ? (await listDiagnosisCodes(actor, hospital)).map((c) => ({
        code: c.code,
        labelFr: c.labelFr,
        labelEn: c.labelEn,
      }))
    : [];
  const canManageClinical = can(actor.roles, "clinical.structure.manage");
  // Phase 2D-2 — prescriptions for this encounter (read by clinicians/pharmacy; doctor creates).
  const canReadPrescriptions = can(actor.roles, "prescription.read");
  const prescriptions = canReadPrescriptions
    ? await listPrescriptionsForEncounter(actor, hospital, id)
    : [];
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("lifecycle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {canManageEncounter ? (
              <>
                <EncounterStatusControls
                  encounterId={encounter.id}
                  status={encounter.status}
                />
                <EncounterServiceForm
                  encounterId={encounter.id}
                  current={encounter.serviceLabel}
                  services={serviceOptions}
                />
              </>
            ) : (
              <p className="text-muted-foreground">{tEnc(encounter.status)}</p>
            )}
            <div className="border-t pt-3">
              <div className="text-muted-foreground mb-2 text-xs font-medium">
                {t("statusHistory")}
              </div>
              <ol className="space-y-1.5">
                {statusHistory.map((h) => (
                  <li key={h.id} className="text-xs">
                    <span className="text-muted-foreground tnum">
                      {formatDateTimeFr(new Date(h.createdAt))}
                    </span>{" "}
                    — {h.summary}
                  </li>
                ))}
              </ol>
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
                      <Link
                        href={`/consultations/${c.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.reason}
                      </Link>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary">{tCons(c.status)}</Badge>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/consultations/${c.id}`}>{t("viewNote")}</Link>
                        </Button>
                      </span>
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
                        diagnosisCodes={diagnosisCodes}
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

        {canReadPrescriptions ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{tPresc("title")}</CardTitle>
              {can(actor.roles, "prescription.create") ? (
                <CardAction>
                  <Button asChild size="sm">
                    <Link href={`/encounters/${encounter.id}/ordonnance/nouvelle`}>
                      {tPresc("newTitle")}
                    </Link>
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {prescriptions.length === 0 ? (
                <p className="text-muted-foreground text-sm">{tPresc("none")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {prescriptions.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-2.5"
                    >
                      <span>
                        <Link
                          href={`/ordonnances/${p.id}`}
                          className="hover:text-primary font-medium"
                        >
                          {p.prescriptionNumber}
                        </Link>{" "}
                        <span className="text-muted-foreground text-xs">
                          {p.items.length} {tPresc("lines")} · {p.prescribedBy.displayName}
                        </span>
                      </span>
                      <Badge variant="secondary">{tPrescStatus(p.status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canReadEmergency ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{tEm("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmergencyControls
                encounterId={encounter.id}
                isEmergency={encounter.isEmergency}
                entries={(emergency?.entries ?? []).map((e) => ({
                  id: e.id,
                  amountLabel: formatFcfa(e.amount),
                  source: e.source,
                  status: e.status,
                  decisionReason: e.decisionReason,
                }))}
                outstandingLabel={formatFcfa(emergency?.outstandingTotal ?? 0)}
                caps={emergencyCaps}
              />
            </CardContent>
          </Card>
        ) : null}

        {canReadAdmission ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{tAdm("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AdmissionControls
                encounterId={encounter.id}
                admission={admissionView}
                wards={wards}
                dischargeBlock={admissionData?.dischargeBlock ?? { blocked: false, reasons: [] }}
                caps={admissionCaps}
              />
            </CardContent>
          </Card>
        ) : null}

        {canReadDiagnostic ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{tDiag("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DiagnosticPanel
                encounterId={encounter.id}
                orders={diagnosticOrders}
                catalogue={diagnosticCatalogue}
                caps={diagnosticCaps}
                canRequest={canRequestDiagnostic}
              />
            </CardContent>
          </Card>
        ) : null}

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
