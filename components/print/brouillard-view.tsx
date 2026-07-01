"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import { BrouillardDocument, type BrouillardData } from "./brouillard-document";

/** Brouillard de Caisse preview + print (Phase 2C) — react-to-print, A4. No recomputation. */
export function BrouillardView({ data }: { data: BrouillardData }) {
  const t = useTranslations("brouillard");
  const contentRef = useRef<HTMLDivElement>(null);

  const print = useReactToPrint({
    contentRef,
    documentTitle: data.shiftNumber,
    pageStyle: "@page { size: A4; margin: 16mm; }",
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => print()}>
          <Printer className="size-4" aria-hidden />
          {t("print")}
        </Button>
      </div>
      <div className="bg-muted/40 rounded-xl border p-4 sm:p-8">
        <div ref={contentRef} className="ring-foreground/10 mx-auto bg-white shadow-sm ring-1">
          <BrouillardDocument data={data} />
        </div>
      </div>
    </div>
  );
}
