import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RequestCancellationForm } from "@/components/billing/cashier-controls";
import { OpenShiftForm } from "@/components/billing/brouillard-controls";
import { RefundActions } from "@/components/billing/refund-controls";
import { BrouillardDocument, type BrouillardData } from "@/components/print/brouillard-document";
import { ReceiptDocument, type ReceiptData } from "@/components/print/receipt-document";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/cancellation-actions", () => ({
  requestCancellationAction: vi.fn(),
  approveCancellationAction: vi.fn(),
  rejectCancellationAction: vi.fn(),
}));
vi.mock("@/server/actions/refund-actions", () => ({
  approveRefundAction: vi.fn(),
  executeRefundAction: vi.fn(),
  cancelRefundAction: vi.fn(),
}));
vi.mock("@/server/actions/cashier-shift-actions", () => ({
  openShiftAction: vi.fn(),
  closeShiftAction: vi.fn(),
  correctShiftAction: vi.fn(),
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

const brouillard: BrouillardData = {
  shiftNumber: "HRB-DEMO-B-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  cashierName: "Solange ABENA",
  statusLabel: "Clôturée",
  openedAtLabel: "29/06/2026 08:00",
  closedAtLabel: "29/06/2026 17:00",
  openingBalance: 10000,
  totalCashReceived: 50000,
  totalMobileCardReceived: 20000,
  totalCancellationsRefunds: 3000,
  expectedClosingBalance: 57000,
  receiptCount: 12,
  corrections: [],
};

describe("Phase 2C — cancellation request + shift controls", () => {
  it("cancellation request form requires a reason", () => {
    renderWithIntl(<RequestCancellationForm invoiceId="inv1" />);
    expect(screen.getByLabelText(/Motif de la demande d'annulation/)).toBeRequired();
    expect(screen.getByRole("button", { name: "Demander l'annulation" })).toBeInTheDocument();
  });

  it("open-shift form has an opening-balance input and open button", () => {
    renderWithIntl(<OpenShiftForm />);
    expect(screen.getByLabelText(/Fonds de caisse initial/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir la caisse" })).toBeInTheDocument();
  });

  it("refund actions hide execute on a non-approved voucher", () => {
    renderWithIntl(
      <RefundActions id="rv1" status="requested" canApprove={false} canExecute={true} />,
    );
    expect(screen.queryByRole("button", { name: "Marquer comme payé" })).not.toBeInTheDocument();
  });

  it("refund actions show execute when approved + canExecute", () => {
    renderWithIntl(
      <RefundActions id="rv1" status="approved" canApprove={false} canExecute={true} />,
    );
    expect(screen.getByRole("button", { name: "Marquer comme payé" })).toBeInTheDocument();
  });
});

describe("Phase 2C — Brouillard de Caisse print document", () => {
  it("renders the five mandatory totals + Chief Cashier signature space", () => {
    renderWithIntl(<BrouillardDocument data={brouillard} />);
    expect(screen.getByText("Total encaissé en espèces")).toBeInTheDocument();
    expect(screen.getByText("Total mobile / carte")).toBeInTheDocument();
    expect(screen.getByText("Total annulations / remboursements")).toBeInTheDocument();
    expect(screen.getByText("Solde de clôture théorique")).toBeInTheDocument();
    expect(screen.getByText("Signature du chef de caisse")).toBeInTheDocument();
    // Synthetic-data prototype marker present.
    expect(screen.getByText(/prototype|démonstration|fictif/i)).toBeInTheDocument();
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
