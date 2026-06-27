import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { ageInYears } from "@/lib/dates";

/**
 * Patient banner (06 §6) — the mandatory, sticky context banner on every
 * patient-scoped screen: name, N° patient, age/sex, hospital, active encounter and
 * status. The user always knows whose record they are in.
 */
export async function PatientBanner({
  patient,
  hospitalName,
  activeEncounter,
}: {
  patient: {
    givenName: string;
    familyName: string;
    patientNumber: string;
    sex: "male" | "female";
    dateOfBirth: Date;
  };
  hospitalName: string;
  activeEncounter?: { encounterNumber: string; status: string } | null;
}) {
  const t = await getTranslations("patient");
  const tSex = await getTranslations("sex");
  const tEnc = await getTranslations("encounterStatus");

  const age = ageInYears(new Date(patient.dateOfBirth));
  const initials =
    `${patient.givenName[0] ?? ""}${patient.familyName[0] ?? ""}`.toUpperCase();

  return (
    <div className="bg-card ring-foreground/5 sticky top-0 z-10 mb-6 rounded-xl border p-4 ring-1">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-full text-sm font-semibold">
            {initials}
          </span>
          <div>
            <div className="text-base font-semibold">
              {patient.givenName} {patient.familyName}
            </div>
            <div className="text-muted-foreground text-xs">
              {t("patientNumber")} :{" "}
              <span className="tnum">{patient.patientNumber}</span>
            </div>
          </div>
        </div>

        <Field
          label={t("ageSex")}
          value={`${age} ${t("years")} · ${tSex(patient.sex)}`}
        />
        <Field label={t("hospital")} value={hospitalName} />
        <Field
          label={t("activeEncounter")}
          value={
            activeEncounter ? (
              <span className="tnum">{activeEncounter.encounterNumber}</span>
            ) : (
              t("noEncounter")
            )
          }
        />
        {activeEncounter ? (
          <Badge variant="secondary">{tEnc(activeEncounter.status)}</Badge>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="leading-tight">
      <div className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
