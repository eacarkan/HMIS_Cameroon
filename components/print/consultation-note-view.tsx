"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import {
  ConsultationNoteDocument,
  type ConsultationNoteData,
} from "./consultation-note-document";

/**
 * Consultation note preview + print (Phase 1A Batch 2). Shows the printable clinical note
 * and prints it (react-to-print, A4). Read-only rendering — no orders, no prescriptions.
 */
export function ConsultationNoteView({ data }: { data: ConsultationNoteData }) {
  const t = useTranslations("consultationNote");
  const contentRef = useRef<HTMLDivElement>(null);

  const print = useReactToPrint({
    contentRef,
    documentTitle: `${data.encounterNumber}-consultation`,
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
          <ConsultationNoteDocument data={data} />
        </div>
      </div>
    </div>
  );
}
