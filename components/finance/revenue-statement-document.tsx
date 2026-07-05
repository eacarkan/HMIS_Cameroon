import { useTranslations } from "next-intl";

import { OFFICIAL_HEADER, PROTOTYPE_LABEL } from "@/lib/constants";
import { formatFcfa } from "@/lib/money";

export type RevenueStatementDocData = {
  number: string;
  periodLabel: string;
  hospitalName: string;
  byMethod: { methodLabel: string; count: number; total: number }[];
  total: number;
  paymentCount: number;
  invoiceCount: number;
  generatedAtLabel: string;
};

/**
 * Printed "État mensuel numéroté des recettes" (Phase 6.6 · Unit 5). An INTERNAL traceability summary —
 * monochrome, official header, numbered, dated. The footer states it is neither a certificate nor an
 * attestation nor an official accounting document; every amount is traceable in the audit log.
 */
export function RevenueStatementDocument({ data }: { data: RevenueStatementDocData }) {
  const t = useTranslations("finance");

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

      <h1 className="mt-7 text-center text-lg font-bold uppercase">{t("statement.title")}</h1>
      <dl className="mx-auto mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-neutral-600">{t("statement.number")}</dt>
        <dd className="tnum text-right font-medium">{data.number}</dd>
        <dt className="text-neutral-600">{t("statement.period")}</dt>
        <dd className="text-right">{data.periodLabel}</dd>
        <dt className="text-neutral-600">{t("statement.generatedAt")}</dt>
        <dd className="tnum text-right">{data.generatedAtLabel}</dd>
        <dt className="text-neutral-600">{t("statement.invoiceCount")}</dt>
        <dd className="tnum text-right">{data.invoiceCount}</dd>
      </dl>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-neutral-300 text-left">
            <th className="py-1.5 font-medium">{t("statement.method")}</th>
            <th className="py-1.5 text-center font-medium">{t("momo.count")}</th>
            <th className="py-1.5 text-right font-medium">{t("statement.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {data.byMethod.map((r) => (
            <tr key={r.methodLabel} className="border-b border-neutral-200">
              <td className="py-1.5">{r.methodLabel}</td>
              <td className="tnum py-1.5 text-center">{r.count}</td>
              <td className="tnum py-1.5 text-right">{formatFcfa(r.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2" colSpan={2}>{t("statement.total")}</td>
            <td className="tnum py-2 text-right">{formatFcfa(data.total)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[11px] text-neutral-600">
        <p>{t("statement.footerNote")}</p>
        <p className="mt-1 font-medium">{PROTOTYPE_LABEL}</p>
      </footer>
    </div>
  );
}
