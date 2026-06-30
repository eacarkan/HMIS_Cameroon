import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listHospitalAdmissions } from "@/server/services";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  requested: "secondary",
  admitted: "default",
  discharge_requested: "secondary",
  discharged: "outline",
  cancelled: "destructive",
};

/** Phase 2G — hospitalization board (ward-level; no bed management). Synthetic data, UAT only. */
export default async function HospitalizationsPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "admission.read")) redirect("/");

  const t = await getTranslations("admission");
  const admissions = await listHospitalAdmissions(actor, hospital);

  return (
    <>
      <PageHeader title={t("boardTitle")} description={t("boardSubtitle")} />

      <Card>
        <CardContent className="p-0">
          {admissions.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">{t("empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="p-3 font-medium">{t("number")}</th>
                  <th className="p-3 font-medium">{t("patient")}</th>
                  <th className="p-3 font-medium">{t("ward")}</th>
                  <th className="p-3 font-medium">{t("statusLabel")}</th>
                  <th className="p-3 font-medium">{t("requestedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/encounters/${a.encounterId}`}
                        className="hover:text-primary tnum font-medium"
                      >
                        {a.admissionNumber}
                      </Link>
                    </td>
                    <td className="p-3">
                      {a.patient.familyName} {a.patient.givenName}{" "}
                      <span className="text-muted-foreground tnum text-xs">{a.patient.patientNumber}</span>
                    </td>
                    <td className="p-3">{a.wardService?.nameFr ?? a.wardService?.name ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>{t(`status_${a.status}`)}</Badge>
                    </td>
                    <td className="text-muted-foreground tnum p-3">
                      {formatDateTimeFr(new Date(a.requestedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
