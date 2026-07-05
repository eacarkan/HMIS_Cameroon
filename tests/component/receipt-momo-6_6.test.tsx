import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReceiptDocument, type ReceiptData } from "@/components/print/receipt-document";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 6.6 · Unit 2 — the printed receipt shows the Mobile-Money operator + reference for a
 * mobile_money payment, and omits that line entirely otherwise.
 */
const base: ReceiptData = {
  paymentId: "p1",
  receiptNumber: "HRB-DEMO-R-2026-000001",
  invoiceNumber: "HRB-DEMO-F-2026-000001",
  patientName: "Test Patient",
  patientNumber: "HRB-DEMO-P-2026-000001",
  hospitalName: "Hôpital de démonstration",
  items: [{ label: "Consultation", quantity: 1, lineTotal: 5000 }],
  total: 5000,
  amount: 5000,
  methodLabel: "mobile money",
  cashierName: "Caissier",
  dateLabel: "01/07/2026",
};

describe("component: Phase 6.6 receipt Mobile Money display", () => {
  it("shows the operator + reference for a mobile_money payment", () => {
    renderWithIntl(
      <ReceiptDocument data={{ ...base, mobileMoneyOperator: "MTN", mobileMoneyReference: "MM-REF-9" }} />,
    );
    expect(screen.getByText(/MTN/)).toBeInTheDocument();
    expect(screen.getByText(/MM-REF-9/)).toBeInTheDocument();
  });

  it("omits the operator line when there is no mobile_money snapshot", () => {
    const { container } = renderWithIntl(<ReceiptDocument data={base} />);
    expect(container.textContent).not.toMatch(/MTN/);
  });
});
