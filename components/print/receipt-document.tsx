import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";
import { formatFcfa } from "@/lib/money";

export type ReceiptData = {
  paymentId: string;
  receiptNumber: string;
  invoiceNumber: string;
  patientName: string;
  patientNumber: string;
  hospitalName: string;
  items: { label: string; quantity: number; lineTotal: number }[];
  total: number;
  amount: number;
  methodLabel: string;
  cashierName: string;
  dateLabel: string;
  /** Marked when the receipt has already been printed before (a duplicate). */
  reprint?: boolean;
  /** Marked when the payment has been voided (invoice cancelled). */
  voided?: boolean;
};

/**
 * Printed payment receipt (06 §13): official header, identifiers, billed lines, amount
 * paid, cashier, signature area, and the prototype label. Monochrome (black on white).
 * Amounts come straight from billing — never recomputed (09 §10).
 */
export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const t = useTranslations("receipt");

  return (
    <div className="mx-auto max-w-[190mm] bg-white p-10 text-black">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full">
        <span className="flex-1 bg-[#007A5E]" />
        <span className="flex-1 bg-[#CE1126]" />
        <span className="flex-1 bg-[#FCD116]" />
      </div>

      <header className="mt-5 text-center leading-tight">
        <p className="text-sm font-semibold tracking-wide uppercase">
          {OFFICIAL_HEADER.country}
        </p>
        <p className="text-sm">{OFFICIAL_HEADER.ministry}</p>
        <p className="mt-1 font-medium">{data.hospitalName}</p>
      </header>

      {data.voided ? (
        <p className="mt-4 border-2 border-black py-1 text-center text-base font-bold tracking-widest uppercase">
          {t("voided")}
        </p>
      ) : data.reprint ? (
        <p className="mt-4 border border-neutral-500 py-1 text-center text-sm font-semibold tracking-widest text-neutral-700 uppercase">
          {t("reprint")}
        </p>
      ) : null}

      <h1 className="mt-7 text-center text-lg font-bold uppercase">
        {t("title")}
      </h1>
      <p className="tnum text-center text-sm">
        {t("number")} : {data.receiptNumber}
      </p>

      <dl className="mx-auto mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-neutral-600">{t("patient")}</dt>
        <dd className="text-right font-medium">{data.patientName}</dd>
        <dt className="text-neutral-600">{t("patientNumber")}</dt>
        <dd className="tnum text-right">{data.patientNumber}</dd>
        <dt className="text-neutral-600">{t("invoiceNumber")}</dt>
        <dd className="tnum text-right">{data.invoiceNumber}</dd>
        <dt className="text-neutral-600">{t("date")}</dt>
        <dd className="tnum text-right">{data.dateLabel}</dd>
      </dl>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-neutral-300 text-left">
            <th className="py-1.5 font-medium">{t("designation")}</th>
            <th className="py-1.5 text-center font-medium">{t("quantity")}</th>
            <th className="py-1.5 text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-1.5">{item.label}</td>
              <td className="tnum py-1.5 text-center">{item.quantity}</td>
              <td className="tnum py-1.5 text-right">
                {formatFcfa(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2" colSpan={2}>
              {t("total")}
            </td>
            <td className="tnum py-2 text-right">{formatFcfa(data.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 flex items-baseline justify-between border-t-2 border-black pt-2">
        <span className="font-bold">{t("amountPaid")}</span>
        <span className="tnum text-lg font-bold">
          {formatFcfa(data.amount)}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-sm">
        <span className="text-neutral-600">{t("method")}</span>
        <span className="font-medium">{data.methodLabel}</span>
      </div>

      <div className="mt-10 flex items-end justify-between text-sm">
        <div>
          <div className="text-neutral-600">{t("cashier")}</div>
          <div className="font-medium">{data.cashierName}</div>
        </div>
        <div className="text-center">
          <div className="text-neutral-600">{t("signature")}</div>
          <div className="mt-10 w-44 border-t border-neutral-400" />
        </div>
      </div>

      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[11px] text-neutral-600">
        <p>{t("footerNote")}</p>
        <p className="mt-1 font-medium">{PROTOTYPE_LABEL}</p>
      </footer>
    </div>
  );
}
