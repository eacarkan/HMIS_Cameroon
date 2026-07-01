import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  AmendConsultationForm,
  FinalizeConsultationButton,
} from "@/components/consultations/consultation-controls";
import { PageHeader } from "@/components/layout/page-header";
import { ConsultationNoteView } from "@/components/print/consultation-note-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getConsultation, getConsultationHistory } from "@/server/services";

/**
 * Consultation summary + printable note (Phase 1A Batch 2). Clinical view (consultation.read):
 * shows the note, its finalize/amend controls (consultation.create), and the audit-derived
 * history. No prescriptions/orders.
 */
export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "consultation.read")) redirect("/");
  const { id } = await params;
  const consultation = await getConsultation(actor, hospital, id);
  if (!consultation) notFound();

  const t = await getTranslations("consultation");
  const tStatus = await getTranslations("consultationStatus");
  const history = await getConsultationHistory(actor, hospital, id);
  const canManage = can(actor.roles, "consultation.create");
  const patient = consultation.encounter.patient;

  const noteData = {
    consultationId: consultation.id,
    encounterNumber: consultation.encounter.encounterNumber,
    patientName: `${patient.givenName} ${patient.familyName}`,
    patientNumber: patient.patientNumber,
    hospitalName: hospital.name,
    clinician: consultation.performedBy?.displayName ?? "—",
    dateLabel: formatDateTimeFr(new Date(consultation.createdAt)),
    statusLabel: tStatus(consultation.status),
    reason: consultation.reason,
    vitals: consultation.vitals,
    clinicalNote: consultation.clinicalNote,
    provisionalDiagnosis: consultation.provisionalDiagnosis,
    recommendation: consultation.recommendation,
    observations: consultation.observations.map((o) => ({ type: o.type, value: o.value, unit: o.unit })),
    diagnoses: consultation.diagnoses.map((d) => ({ label: d.label, code: d.code, isPrimary: d.isPrimary })),
  };

  return (
    <>
      <PageHeader
        title={t("summaryTitle")}
        description={consultation.encounter.encounterNumber}
        actions={<Badge variant="secondary">{tStatus(consultation.status)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConsultationNoteView data={noteData} />
        </div>

        <div className="space-y-6">
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {consultation.status === "draft" ? t("finalizeTitle") : t("amendTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {consultation.status === "draft" ? (
                  <FinalizeConsultationButton consultationId={consultation.id} />
                ) : (
                  <AmendConsultationForm
                    consultationId={consultation.id}
                    values={{
                      clinicalNote: consultation.clinicalNote,
                      vitals: consultation.vitals,
                      provisionalDiagnosis: consultation.provisionalDiagnosis,
                      recommendation: consultation.recommendation,
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5 text-xs">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="text-muted-foreground tnum">
                      {formatDateTimeFr(new Date(h.createdAt))}
                    </span>{" "}
                    — {h.summary}
                    {h.actor ? ` · ${h.actor.displayName}` : ""}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
