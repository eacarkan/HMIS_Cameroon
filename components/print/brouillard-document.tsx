import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";
import { formatFcfa } from "@/lib/money";

export type BrouillardCorrection = {
  reason: string;
  note: string;
  correctedByName: string;
  dateLabel: string;
};

export type BrouillardData = {
  shiftNumber: string;
  hospitalName: string;
  cashierName: string;
  statusLabel: string;
  openedAtLabel: string;
  closedAtLabel: string | null;
  openingBalance: number;
  totalCashReceived: number;
  totalMobileCardReceived: number;
  totalCancellationsRefunds: number;
  expectedClosingBalance: number;
  receiptCount: number;
  corrections: BrouillardCorrection[];
};

/**
 * Printed Brouillard de Caisse (Phase 2C): official header, the five mandatory totals, corrections
 * history, and a Chief Cashier signature/stamp space. Monochrome; amounts come straight from the
 * frozen record — never recomputed. Synthetic-data prototype marker included.
 */
export function BrouillardDocument({ data }: { data: BrouillardData }) {
  const t = useTranslations("brouillard");

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
      <p className="text-center text-sm">{data.shiftNumber}</p>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <Row label={t("cashier")} value={data.cashierName} />
        <Row label={t("status")} value={data.statusLabel} />
        <Row label={t("openedAt")} value={data.openedAtLabel} />
        <Row label={t("closedAt")} value={data.closedAtLabel ?? "—"} />
      </dl>

      <table className="mt-6 w-full border-collapse text-sm">
        <tbody>
          <MoneyRow label={t("openingBalance")} value={data.openingBalance} />
          <MoneyRow label={t("totalCashReceived")} value={data.totalCashReceived} />
          <MoneyRow label={t("totalMobileCardReceived")} value={data.totalMobileCardReceived} />
          <MoneyRow label={t("totalCancellationsRefunds")} value={data.totalCancellationsRefunds} />
          <tr className="border-t-2 border-black font-bold">
            <td className="py-2">{t("expectedClosingBalance")}</td>
            <td className="py-2 text-right tabular-nums">{formatFcfa(data.expectedClosingBalance)}</td>
          </tr>
          <tr className="border-t border-neutral-400">
            <td className="py-2">{t("receiptCount")}</td>
            <td className="py-2 text-right tabular-nums">{data.receiptCount}</td>
          </tr>
        </tbody>
      </table>

      {data.corrections.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">{t("corrections")}</h2>
          <ul className="mt-2 space-y-1 text-xs">
            {data.corrections.map((c, i) => (
              <li key={i} className="border-b border-neutral-300 pb-1">
                <span className="font-medium">{c.dateLabel}</span> — {c.reason} : {c.note} (
                {c.correctedByName})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-12 flex justify-end">
        <div className="w-64 border-t border-black pt-1 text-center text-xs">
          {t("chiefCashierSignature")}
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

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-neutral-300">
      <td className="py-2">{label}</td>
      <td className="py-2 text-right tabular-nums">{formatFcfa(value)}</td>
    </tr>
  );
}
