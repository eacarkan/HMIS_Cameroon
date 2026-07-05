import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { AppCredit } from "@/components/layout/app-credit";
import { ReceiptDocument, type ReceiptData } from "@/components/print/receipt-document";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import { renderWithIntl } from "../helpers/render";

/**
 * Authorship / technical credit for the SantéGrid demonstration. It must render (bilingually)
 * in site chrome, and it must NEVER appear on operational print documents (receipts, monthly
 * revenue statements, invoices, consultation notes). This test pins both halves.
 */
const FR_CREDIT =
  "Conception technique et développement de la démonstration : ACN Engineering Co. — Erdem ACARKAN";
const EN_CREDIT =
  "Technical design and demonstration development: ACN Engineering Co. — Erdem ACARKAN";

describe("component: SantéGrid technical credit", () => {
  it("exposes the exact bilingual credit string in the app namespace", () => {
    expect(frMessages.app.techCredit).toBe(FR_CREDIT);
    expect(enMessages.app.techCredit).toBe(EN_CREDIT);
  });

  it("renders the French credit", () => {
    renderWithIntl(<AppCredit />);
    expect(screen.getByText(FR_CREDIT)).toBeInTheDocument();
  });

  it("renders the English credit under the en overlay", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <AppCredit />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(EN_CREDIT)).toBeInTheDocument();
  });

  it("does NOT render the credit on the printed receipt document", () => {
    const data: ReceiptData = {
      paymentId: "p1",
      receiptNumber: "HRB-DEMO-R-2026-000001",
      invoiceNumber: "HRB-DEMO-F-2026-000001",
      patientName: "Test Patient",
      patientNumber: "HRB-DEMO-P-2026-000001",
      hospitalName: "Hôpital de démonstration",
      items: [{ label: "Consultation", quantity: 1, lineTotal: 5000 }],
      total: 5000,
      amount: 5000,
      methodLabel: "espèces",
      cashierName: "Caissier",
      dateLabel: "01/07/2026",
    };
    const { container } = renderWithIntl(<ReceiptDocument data={data} />);
    expect(container.textContent).not.toMatch(/ACN Engineering|Erdem ACARKAN|techCredit/i);
  });

  it("no *-document.tsx print component references the credit (source guard)", () => {
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (/-document\.tsx$/.test(entry)) out.push(full);
      }
      return out;
    };
    const docFiles = walk("components");
    // Sanity: we actually found the operational print documents to guard.
    expect(docFiles.length).toBeGreaterThanOrEqual(3);
    for (const f of docFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} must not carry the authorship credit`).not.toMatch(
        /AppCredit|techCredit|ACN Engineering|Erdem ACARKAN/,
      );
    }
  });
});
