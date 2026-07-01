import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DecisionForm, GenerateCandidatesForm, MockMpiForm, StartReviewForm } from "@/components/patients/match-review";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getPatientMatchReview } from "@/server/services";

/**
 * Phase 4G — patient-match review queue. LOCAL, hospital-scoped, WARNING-ONLY duplicate candidates + a
 * manual review with a mandatory reason. NO automatic merge; a decision records judgment only and never
 * modifies a patient record. Mock MPI — no live call. Central supervisor cannot see this (per-hospital
 * capability). Synthetic data only.
 */
type Signal = { type: string; weight: number };

export default async function MatchReviewPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "patient_match.review")) redirect("/");

  const t = await getTranslations("patientMatch");
  const { candidates, activeCount, mpiLiveEnabled } = await getPatientMatchReview(actor, hospital);
  const active = ["CANDIDATE", "UNDER_REVIEW", "NEEDS_MORE_INFORMATION"];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="border-primary/40 bg-primary/5 -mt-2 mb-4 grid gap-1 rounded-md border px-3 py-2 text-xs">
        <strong>{t("noMergeNotice")}</strong>
        <span>{mpiLiveEnabled ? t("mpiLiveWarning") : t("mpiMockNotice")}</span>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">{t("generateTitle")} · {t("activeCount", { count: activeCount })}</CardTitle></CardHeader>
        <CardContent><GenerateCandidatesForm /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("queue")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {candidates.length === 0 ? <p className="text-muted-foreground text-sm">{t("empty")}</p> : null}
          {candidates.map((c) => {
            const signals = (c.signals as Signal[] | null) ?? [];
            return (
              <div key={c.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.sourcePatient.patientNumber} ↔ {c.candidatePatient.patientNumber}{" "}
                    <span className="tnum text-muted-foreground text-xs">({t("score")} {c.score})</span>
                  </span>
                  <Badge variant={c.status === "MARKED_DUPLICATE" ? "destructive" : active.includes(c.status) ? "secondary" : "outline"}>
                    {t(`statuses.${c.status}`)}
                  </Badge>
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {t("signals")}: {signals.length === 0 ? "—" : signals.map((s) => t(`signalsLabels.${s.type}`)).join(" · ")}
                </div>
                {c.reviewReason ? <div className="mt-1 text-xs"><span className="text-muted-foreground">{t("reason")}:</span> {c.reviewReason}</div> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 border-t pt-2">
                  {c.status === "CANDIDATE" ? <StartReviewForm id={c.id} /> : null}
                  {c.status === "UNDER_REVIEW" || c.status === "NEEDS_MORE_INFORMATION" ? <DecisionForm id={c.id} /> : null}
                  {active.includes(c.status) ? <MockMpiForm id={c.id} /> : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
