"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import { printReceiptAction } from "@/server/actions/receipt-actions";
import { ReceiptDocument, type ReceiptData } from "./receipt-document";

/**
 * Receipt preview + print (06 §13). Shows the official receipt and prints it
 * (react-to-print, A4); printing also logs `receipt.print` via the server action.
 */
export function ReceiptView({ data }: { data: ReceiptData }) {
  const tActions = useTranslations("actions");
  const contentRef = useRef<HTMLDivElement>(null);

  const print = useReactToPrint({
    contentRef,
    documentTitle: data.receiptNumber,
    pageStyle: "@page { size: A4; margin: 16mm; }",
  });

  const onPrint = () => {
    void printReceiptAction(data.paymentId);
    print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onPrint}>
          <Printer className="size-4" aria-hidden />
          {tActions("printReceipt")}
        </Button>
      </div>
      <div className="bg-muted/40 rounded-xl border p-4 sm:p-8">
        <div
          ref={contentRef}
          className="ring-foreground/10 mx-auto bg-white shadow-sm ring-1"
        >
          <ReceiptDocument data={data} />
        </div>
      </div>
    </div>
  );
}
