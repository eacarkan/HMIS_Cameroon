import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ConfirmPaymentButton,
  DispenseButton,
} from "@/components/pharmacy/dispense-controls";
import { DispenseDocument, type DispenseData } from "@/components/print/dispense-document";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/dispensing-actions", () => ({
  confirmPaymentAction: vi.fn(),
  dispenseAction: vi.fn(),
}));

const data: DispenseData = {
  dispenseNumber: "HRB-DEMO-D-2026-000001",
  prescriptionNumber: "HRB-DEMO-O-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  patientName: "Aïssatou BELLO",
  pharmacistName: "Georges MBALLA",
  dateLabel: "30/06/2026 10:00",
  items: [{ medicationLabel: "Paracétamol 500 mg", unit: "comprimé", quantity: 15, batchNumber: "LOT-PARA-B" }],
};

describe("Phase 2D-5 — dispense controls + record", () => {
  it("renders the confirm-payment and dispense buttons", () => {
    renderWithIntl(<ConfirmPaymentButton prescriptionId="p1" />);
    expect(screen.getByRole("button", { name: "Confirmer le paiement" })).toBeInTheDocument();
    renderWithIntl(<DispenseButton prescriptionId="p1" />);
    expect(screen.getByRole("button", { name: "Délivrer" })).toBeInTheDocument();
  });

  it("the dispense record shows tracking number, batch line, signature space + synthetic marker", () => {
    renderWithIntl(<DispenseDocument data={data} />);
    expect(screen.getByText("HRB-DEMO-D-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("LOT-PARA-B")).toBeInTheDocument();
    expect(screen.getByText("Paracétamol 500 mg")).toBeInTheDocument();
    expect(screen.getByText(/Signature/)).toBeInTheDocument();
    expect(screen.getByText(/prototype|démonstration|fictif/i)).toBeInTheDocument();
  });
});
