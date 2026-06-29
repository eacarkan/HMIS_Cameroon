import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CloseShiftButton, VoidInvoiceForm } from "@/components/billing/cashier-controls";
import { ReceiptDocument, type ReceiptData } from "@/components/print/receipt-document";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/billing-actions", () => ({
  voidInvoiceAction: vi.fn(),
  closeCashierShiftAction: vi.fn(),
}));

const baseReceipt: ReceiptData = {
  paymentId: "p1",
  receiptNumber: "HRB-DEMO-R-2026-000001",
  invoiceNumber: "HRB-DEMO-F-2026-000001",
  patientName: "Aïssatou BELLO",
  patientNumber: "HRB-DEMO-P-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  items: [{ label: "Consultation", quantity: 1, lineTotal: 2000 }],
  total: 2000,
  amount: 2000,
  methodLabel: "Espèces",
  cashierName: "Solange ABENA",
  dateLabel: "27/06/2026 10:05",
};

describe("Phase 1A Batch 3 — cashier controls", () => {
  it("void form requires a reason", () => {
    renderWithIntl(<VoidInvoiceForm invoiceId="inv1" />);
    expect(screen.getByLabelText("Motif d'annulation")).toBeRequired();
    expect(screen.getByRole("button", { name: "Annuler la facture" })).toBeInTheDocument();
  });

  it("close-shift button renders", () => {
    renderWithIntl(<CloseShiftButton date="2026-06-27" />);
    expect(screen.getByRole("button", { name: "Clôturer la caisse" })).toBeInTheDocument();
  });
});

describe("Phase 1A Batch 3 — receipt markings", () => {
  it("marks a voided receipt", () => {
    renderWithIntl(<ReceiptDocument data={{ ...baseReceipt, voided: true }} />);
    expect(screen.getByText("Reçu annulé")).toBeInTheDocument();
  });

  it("marks a reprinted (duplicate) receipt", () => {
    renderWithIntl(<ReceiptDocument data={{ ...baseReceipt, reprint: true }} />);
    expect(screen.getByText(/Réimpression — duplicata/)).toBeInTheDocument();
  });

  it("a normal receipt shows neither marking", () => {
    renderWithIntl(<ReceiptDocument data={baseReceipt} />);
    expect(screen.queryByText("Reçu annulé")).not.toBeInTheDocument();
    expect(screen.queryByText(/Réimpression/)).not.toBeInTheDocument();
  });
});
