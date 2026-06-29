import { DoorOpen, Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { PatientBanner } from "@/components/patients/patient-banner";
import { PatientIdentityPanel } from "@/components/patients/patient-identity-panel";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import {
  getPatient,
  getPatientTimeline,
  listPatientContacts,
  listPatientIdentifiers,
  listDuplicateCandidatesForActor,
} from "@/server/services";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  const { id } = await params;
  const patient = await getPatient(actor, hospital, id);
  if (!patient) notFound();

  const t = await getTranslations("patient");
  const tEnc = await getTranslations("encounterStatus");
  const tInv = await getTranslations("invoiceStatus");
  const tActions = await getTranslations("actions");
  const tTimeline = await getTranslations("timeline");

  const activeEncounter =
    patient.encounters.find((e) => e.status === "open") ?? null;
  const invoices = patient.encounters.flatMap((e) => e.invoices);

  // Read-only chronological timeline (Batch 1B), composed server-side from existing records.
  const timeline = await getPatientTimeline(actor, hospital, id);

  // Identity/contact panel (Gate 4): reception manages, clinician may read. Data is
  // fetched through the Gate 3 service (server-side RBAC + hospital scoping).
  const canReadIdentity = can(actor.roles, "patient.identity.read");
  const canManageIdentity = can(actor.roles, "patient.identity.manage");
  const contacts = canReadIdentity
    ? await listPatientContacts(actor, hospital, id)
    : [];
  const identifiers = canReadIdentity
    ? await listPatientIdentifiers(actor, hospital, id)
    : [];
  const duplicates = can(actor.roles, "patient.duplicate.manage")
    ? (await listDuplicateCandidatesForActor(actor, hospital)).filter(
        (d) => d.patientId === id || d.candidatePatientId === id,
      )
    : [];

  const action =
    can(actor.roles, "encounter.create") && !activeEncounter ? (
      <Button asChild>
        <Link href={`/patients/${patient.id}/visite/nouvelle`}>
          <DoorOpen className="size-4" aria-hidden />
          {tActions("openEncounter")}
        </Link>
      </Button>
    ) : activeEncounter ? (
      <Button asChild variant="secondary">
        <Link href={`/encounters/${activeEncounter.id}`}>
          <Eye className="size-4" aria-hidden />
          {tActions("viewEncounter")}
        </Link>
      </Button>
    ) : undefined;

  return (
    <>
      <PatientBanner
        patient={patient}
        hospitalName={hospital.name}
        activeEncounter={
          activeEncounter
            ? {
                encounterNumber: activeEncounter.encounterNumber,
                status: activeEncounter.status,
              }
            : null
        }
      />
      <PageHeader
        title={`${patient.givenName} ${patient.familyName}`}
        actions={action}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sectionDossier")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label={t("registeredOn")}
              value={formatDateFr(new Date(patient.createdAt))}
            />
            <Row label={t("phone")} value={patient.phone ?? "—"} />
            <Row label={t("residence")} value={patient.residence ?? "—"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("sectionVisites")}</CardTitle>
          </CardHeader>
          <CardContent>
            {patient.encounters.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noVisits")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {patient.encounters.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/encounters/${e.id}`}
                      className="hover:text-primary min-w-0"
                    >
                      <span className="tnum block font-medium">
                        {e.encounterNumber}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {e.serviceLabel} · {formatDateFr(new Date(e.openedAt))}
                      </span>
                    </Link>
                    <Badge variant="secondary">{tEnc(e.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{tTimeline("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PatientTimeline events={timeline} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("sectionFactures")}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noInvoices")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <Link
                      href={`/factures/${inv.id}`}
                      className="hover:text-primary tnum font-medium"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <span className="flex items-center gap-3">
                      <span className="tnum">
                        {formatFcfa(inv.totalAmount)}
                      </span>
                      <Badge variant="secondary">{tInv(inv.status)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canReadIdentity ? (
          <PatientIdentityPanel
            patientId={patient.id}
            canManage={canManageIdentity}
            contacts={contacts.map((c) => ({
              id: c.id,
              contactType: c.contactType,
              value: c.value,
              label: c.label,
            }))}
            identifiers={identifiers.map((i) => ({
              id: i.id,
              identifierType: i.identifierType,
              value: i.value,
              issuingAuthority: i.issuingAuthority,
            }))}
            duplicates={duplicates.map((d) => ({
              id: d.id,
              matchBasis: d.matchBasis,
              status: d.status,
            }))}
          />
        ) : null}
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
