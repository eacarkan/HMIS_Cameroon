import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";

export type ConsultationNoteData = {
  consultationId: string;
  encounterNumber: string;
  patientName: string;
  patientNumber: string;
  hospitalName: string;
  clinician: string;
  dateLabel: string;
  statusLabel: string;
  reason: string;
  vitals: string | null;
  clinicalNote: string | null;
  provisionalDiagnosis: string | null;
  recommendation: string | null;
  observations: { type: string; value: string; unit: string | null }[];
  diagnoses: { label: string; code: string | null; isPrimary: boolean }[];
};

/**
 * Printed consultation note (Phase 1A Batch 2): institutional (simulated) header, patient
 * context, structured observations + diagnoses, free-text sections, and the prototype label.
 * Monochrome. Free-text wraps so short and long content both print cleanly. NO prescriptions.
 */
export function ConsultationNoteDocument({ data }: { data: ConsultationNoteData }) {
  const t = useTranslations("consultationNote");

  return (
    <div className="mx-auto max-w-[190mm] bg-white p-10 text-black">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full">
        <span className="flex-1 bg-[#007A5E]" />
        <span className="flex-1 bg-[#CE1126]" />
        <span className="flex-1 bg-[#FCD116]" />
      </div>

      <header className="mt-5 text-center leading-tight">
        <p className="text-sm font-semibold tracking-wide uppercase">{OFFICIAL_HEADER.country}</p>
        <p className="text-sm">{OFFICIAL_HEADER.ministry}</p>
        <p className="mt-1 font-medium">{data.hospitalName}</p>
      </header>

      <h1 className="mt-7 text-center text-lg font-bold uppercase">{t("title")}</h1>

      <dl className="mx-auto mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-neutral-600">{t("patient")}</dt>
        <dd className="text-right font-medium">{data.patientName}</dd>
        <dt className="text-neutral-600">{t("patientNumber")}</dt>
        <dd className="tnum text-right">{data.patientNumber}</dd>
        <dt className="text-neutral-600">{t("encounter")}</dt>
        <dd className="tnum text-right">{data.encounterNumber}</dd>
        <dt className="text-neutral-600">{t("clinician")}</dt>
        <dd className="text-right">{data.clinician}</dd>
        <dt className="text-neutral-600">{t("date")}</dt>
        <dd className="tnum text-right">{data.dateLabel}</dd>
        <dt className="text-neutral-600">{t("status")}</dt>
        <dd className="text-right font-medium">{data.statusLabel}</dd>
      </dl>

      <Section title={t("reason")}>{data.reason}</Section>
      {data.vitals ? <Section title={t("vitals")}>{data.vitals}</Section> : null}

      {data.observations.length > 0 ? (
        <div className="mt-5">
          <h2 className="border-b border-neutral-300 pb-1 text-sm font-semibold">{t("observations")}</h2>
          <ul className="mt-2 text-sm">
            {data.observations.map((o, i) => (
              <li key={i} className="flex justify-between border-b border-neutral-100 py-1">
                <span className="text-neutral-600">{o.type}</span>
                <span className="font-medium">
                  {o.value}
                  {o.unit ? ` ${o.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.diagnoses.length > 0 ? (
        <div className="mt-5">
          <h2 className="border-b border-neutral-300 pb-1 text-sm font-semibold">{t("diagnoses")}</h2>
          <ul className="mt-2 text-sm">
            {data.diagnoses.map((d, i) => (
              <li key={i} className="flex justify-between border-b border-neutral-100 py-1">
                <span>
                  {d.label}
                  {d.isPrimary ? ` (${t("primary")})` : ""}
                </span>
                {d.code ? <span className="tnum text-neutral-600">{d.code}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.clinicalNote ? <Section title={t("clinicalNote")}>{data.clinicalNote}</Section> : null}
      {data.provisionalDiagnosis ? (
        <Section title={t("provisionalDiagnosis")}>{data.provisionalDiagnosis}</Section>
      ) : null}
      {data.recommendation ? <Section title={t("recommendation")}>{data.recommendation}</Section> : null}

      <div className="mt-12 flex items-end justify-end text-sm">
        <div className="text-center">
          <div className="text-neutral-600">{t("clinicianSignature")}</div>
          <div className="mt-10 w-52 border-t border-neutral-400" />
          <div className="mt-1 text-xs">{data.clinician}</div>
        </div>
      </div>

      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[11px] text-neutral-600">
        <p>{t("footerNote")}</p>
        <p className="mt-1 font-medium">{PROTOTYPE_LABEL}</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="border-b border-neutral-300 pb-1 text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm break-words whitespace-pre-wrap">{children}</p>
    </div>
  );
}
