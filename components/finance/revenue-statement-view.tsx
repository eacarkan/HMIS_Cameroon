"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import { generateStatementAction } from "@/server/actions/revenue-statement-actions";
import { RevenueStatementDocument, type RevenueStatementDocData } from "./revenue-statement-document";

/** The "Générer l'état numéroté" button — posts the period to the audited numbering action. */
export function GenerateStatementForm({ period }: { period: string }) {
  const t = useTranslations("finance");
  return (
    <form action={generateStatementAction.bind(null, period)}>
      <Button type="submit">{t("statement.generate")}</Button>
    </form>
  );
}

/** The numbered statement preview + A4 print (react-to-print), mirroring the receipt print pattern. */
export function RevenueStatementView({ data }: { data: RevenueStatementDocData }) {
  const t = useTranslations("finance");
  const contentRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({
    contentRef,
    documentTitle: data.number,
    pageStyle: "@page { size: A4; margin: 16mm; }",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => print()}>
          <Printer className="size-4" aria-hidden />
          {t("statement.print")}
        </Button>
      </div>
      <div className="bg-muted/40 rounded-xl border p-4 sm:p-8">
        <div ref={contentRef} className="ring-foreground/10 mx-auto bg-white shadow-sm ring-1">
          <RevenueStatementDocument data={data} />
        </div>
      </div>
    </div>
  );
}
