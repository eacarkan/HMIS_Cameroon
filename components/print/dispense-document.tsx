import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";

export type DispenseItemData = {
  medicationLabel: string;
  unit: string;
  quantity: number;
  batchNumber: string;
};

export type DispenseData = {
  dispenseNumber: string;
  prescriptionNumber: string;
  hospitalName: string;
  patientName: string;
  pharmacistName: string;
  dateLabel: string;
  items: DispenseItemData[];
};

/**
 * Printed dispense record ("bon de délivrance") — Phase 2D-5: official header, tracking number,
 * the prescription reference, the dispensed lines (medication, batch, quantity), pharmacist
 * signature space, and the synthetic-data marker. Monochrome.
 */
export function DispenseDocument({ data }: { data: DispenseData }) {
  const t = useTranslations("dispense");
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

      <h1 className="mt-7 text-center text-lg font-bold uppercase">{t("documentTitle")}</h1>
      <p className="text-center text-sm">{data.dispenseNumber}</p>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <Row label={t("prescription")} value={data.prescriptionNumber} />
        <Row label={t("patient")} value={data.patientName} />
        <Row label={t("pharmacist")} value={data.pharmacistName} />
        <Row label={t("date")} value={data.dateLabel} />
      </dl>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1">{t("medication")}</th>
            <th className="py-1">{t("batch")}</th>
            <th className="py-1 text-right">{t("quantity")}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="border-b border-neutral-300">
              <td className="py-1.5 font-medium">{it.medicationLabel}</td>
              <td className="py-1.5">{it.batchNumber}</td>
              <td className="py-1.5 text-right tabular-nums">
                {it.quantity} {it.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-12 flex justify-end">
        <div className="w-64 border-t border-black pt-1 text-center text-xs">
          {t("signature")} — {data.pharmacistName}
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] tracking-wide text-neutral-500 uppercase">
        {PROTOTYPE_LABEL}
      </p>
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
