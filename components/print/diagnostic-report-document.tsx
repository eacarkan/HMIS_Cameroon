import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";

export type DiagnosticReportData = {
  orderNumber: string;
  hospitalName: string;
  patientName: string;
  patientNumber: string;
  modalityLabel: string;
  examLabel: string;
  resultText: string;
  validatorName: string;
  dateLabel: string;
};

/**
 * Printed lab/radiology report — Phase 2I: official header, document tracking number, the validated
 * text result, the validator's name, a stamp/signature space, and the synthetic-data prototype marker.
 * Generic template (no analyzer/PACS); radiology is text-only. Monochrome.
 */
export function DiagnosticReportDocument({ data }: { data: DiagnosticReportData }) {
  const t = useTranslations("diagnostic");

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

      <h1 className="mt-7 text-center text-lg font-bold uppercase">{t("reportTitle")}</h1>
      <p className="text-center text-sm">{data.orderNumber}</p>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <Row label={t("patient")} value={data.patientName} />
        <Row label={t("patientNumber")} value={data.patientNumber} />
        <Row label={t("modality")} value={data.modalityLabel} />
        <Row label={t("exam")} value={data.examLabel} />
        <Row label={t("date")} value={data.dateLabel} />
      </dl>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase">{t("result")}</h2>
        <div className="mt-2 min-h-24 rounded-md border border-neutral-300 p-3 text-sm whitespace-pre-wrap">
          {data.resultText}
        </div>
      </section>

      <div className="mt-12 flex justify-end">
        <div className="w-64 border-t border-black pt-1 text-center text-xs">
          {t("validatedBy")} — {data.validatorName}
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] tracking-wide text-neutral-500 uppercase">{PROTOTYPE_LABEL}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
