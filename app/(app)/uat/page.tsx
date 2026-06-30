import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Gate7ItemForm, Gate7SignoffForm, RecordUatForm } from "@/components/admin/uat-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getUatEvidence } from "@/server/services";

/**
 * Phase 3E — UAT evidence & Gate 7 readiness. EVIDENCE ONLY — the page states plainly it is NOT an
 * authorization (Gate 7 is administrative, co-signed Director + MINSANTE). Per-hospital RBAC; the
 * sign-off fields are placeholders. Synthetic UAT only.
 */
export default async function UatReadinessPage() {
  const { actor, hospital } = await requireActorAndHospital();
  const rolesHere = actor.rolesByHospital[hospital.hospitalId] ?? [];
  if (!can(rolesHere, "uat.view")) redirect("/");
  const canManage = can(rolesHere, "uat.manage");
  const canSignoff = can(rolesHere, "uat.signoff_placeholder");

  const t = await getTranslations("uat");
  const locale = await getLocale();
  const ev = await getUatEvidence(actor, hospital);
  const disclaimer = locale === "en" ? ev.disclaimerEn : ev.disclaimerFr;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* The mandatory, prominent non-authorization disclaimer (doc 34 §8.14). */}
      <div role="note" className="border-amber-500/40 bg-amber-500/10 mb-6 rounded-md border p-3 text-sm font-medium">
        ⚠ {disclaimer}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("readinessFor", { hospital: hospital.name })}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            {t("uatPass")}: <span className="tnum font-medium">{ev.uat.pass}/{ev.uat.total}</span>
            {" · "}
            {t("gate7Ready")}: <span className="tnum font-medium">{ev.signal.criteriaReady}/{ev.signal.criteriaTotal}</span>
          </p>
          <p className="mt-2">
            {ev.signal.evidenceComplete ? (
              <Badge variant="secondary">{t("evidenceComplete")}</Badge>
            ) : (
              <Badge variant="outline">{t("evidenceIncomplete")}</Badge>
            )}
            {ev.uat.hasBlocker ? <Badge variant="outline" className="ml-2">{t("hasBlocker")}</Badge> : null}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">{t("notAuthorizedNote")}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("uatScenarios")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {ev.scenarios.map((s) => (
                <li key={s.code} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{locale === "en" ? (s.titleEn ?? s.titleFr) : s.titleFr}</span>{" "}
                      <span className="text-muted-foreground text-xs">({s.code})</span>
                    </span>
                    <Badge variant={s.status === "pass" ? "secondary" : "outline"}>{t(`statuses.${s.status}`)}</Badge>
                  </div>
                  {canManage ? (
                    <div className="mt-2">
                      <RecordUatForm code={s.code} status={s.status} notes={s.notes} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("gate7Checklist")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {ev.gate7.map((g) => (
                <li key={g.criterion} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{locale === "en" ? g.labelEn : g.labelFr}</span>
                    <Badge variant={g.status === "ready" ? "secondary" : "outline"}>{t(`gate7Statuses.${g.status}`)}</Badge>
                  </div>
                  {canManage ? (
                    <div className="mt-2">
                      <Gate7ItemForm criterion={g.criterion} status={g.status} note={g.note} />
                    </div>
                  ) : null}
                  {canSignoff ? (
                    <div className="mt-2">
                      <Gate7SignoffForm
                        criterion={g.criterion}
                        director={g.directorSignoffPlaceholder}
                        minsante={g.minsanteSignoffPlaceholder}
                      />
                    </div>
                  ) : g.directorSignoffPlaceholder || g.minsanteSignoffPlaceholder ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("director")}: {g.directorSignoffPlaceholder ?? "—"} · {t("minsante")}: {g.minsanteSignoffPlaceholder ?? "—"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
