import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReservationOverridePanel, type ReservationRow } from "@/components/pharmacy/reservation-override";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/fefo-actions", () => ({
  overrideFefoAction: vi.fn(),
}));

const row: ReservationRow = {
  id: "res-1",
  quantity: 15,
  unit: "comprimé",
  medicationLabel: "Paracétamol 500 mg",
  isFefoOverride: false,
  overrideReason: null,
  batch: { batchNumber: "LOT-PARA-B", expiryLabel: "31/12/2026" },
  isCurrentFefo: true,
  candidates: [{ id: "b-late", batchNumber: "LOT-PARA-A", expiryLabel: "30/06/2027", available: 500 }],
};

describe("Phase 2D-6 — reservation override panel", () => {
  it("shows the reserved lot with a FEFO badge and the override control for the Pharmacist-in-Charge", () => {
    renderWithIntl(
      <ReservationOverridePanel prescriptionId="presc-1" reservations={[row]} canOverride={true} />,
    );
    expect(screen.getByText("Paracétamol 500 mg")).toBeInTheDocument();
    expect(screen.getByText("FEFO")).toBeInTheDocument();
    expect(screen.getByLabelText("Choisir un autre lot")).toBeInTheDocument();
    expect(screen.getByLabelText("Motif de la dérogation FEFO")).toBeRequired();
    expect(screen.getByRole("button", { name: "Déroger (FEFO)" })).toBeInTheDocument();
  });

  it("hides the override control when the viewer is not the Pharmacist-in-Charge", () => {
    renderWithIntl(
      <ReservationOverridePanel prescriptionId="presc-1" reservations={[row]} canOverride={false} />,
    );
    expect(screen.getByText("Paracétamol 500 mg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Déroger (FEFO)" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choisir un autre lot")).not.toBeInTheDocument();
  });

  it("renders an already-overridden reservation with its reason", () => {
    renderWithIntl(
      <ReservationOverridePanel
        prescriptionId="presc-1"
        reservations={[{ ...row, isFefoOverride: true, isCurrentFefo: false, overrideReason: "Lot endommagé" }]}
        canOverride={true}
      />,
    );
    expect(screen.getByText("Dérogation FEFO")).toBeInTheDocument();
    expect(screen.getByText(/Lot endommagé/)).toBeInTheDocument();
  });
});
