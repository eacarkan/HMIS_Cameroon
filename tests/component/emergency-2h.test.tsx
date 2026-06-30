import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmergencyControls, type EmergencyDebtRow } from "@/components/emergency/emergency-controls";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/emergency-actions", () => ({
  flagEmergencyAction: vi.fn(),
  accrueEmergencyDebtAction: vi.fn(),
  settleEmergencyDebtAction: vi.fn(),
  waiveEmergencyDebtAction: vi.fn(),
}));

const allCaps = { flag: true, accrue: true, settle: true, waive: true };
const debt: EmergencyDebtRow = {
  id: "d1",
  amountLabel: "3 000 FCFA",
  source: "Consultation",
  status: "outstanding",
  decisionReason: null,
};

describe("Phase 2H — emergency controls", () => {
  it("a non-emergency encounter shows only the flag button (no accrue/ledger)", () => {
    renderWithIntl(
      <EmergencyControls encounterId="e1" isEmergency={false} entries={[]} outstandingLabel="0 FCFA" caps={allCaps} />,
    );
    expect(screen.getByRole("button", { name: "Marquer urgence" })).toBeInTheDocument();
    expect(screen.queryByText("Enregistrer la dette")).not.toBeInTheDocument();
  });

  it("an emergency encounter shows the accrue form + the outstanding total + a settle/waive ledger", () => {
    renderWithIntl(
      <EmergencyControls
        encounterId="e1"
        isEmergency={true}
        entries={[debt]}
        outstandingLabel="3 000 FCFA"
        caps={allCaps}
      />,
    );
    expect(screen.getByText("URGENCE")).toBeInTheDocument();
    expect(screen.getByLabelText("Montant (FCFA)")).toBeRequired();
    expect(screen.getByRole("button", { name: "Enregistrer la dette" })).toBeInTheDocument();
    expect(screen.getAllByText(/3 000 FCFA/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Régler" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler (Directeur)" })).toBeInTheDocument();
  });

  it("a viewer without the waive cap sees no waive control", () => {
    renderWithIntl(
      <EmergencyControls
        encounterId="e1"
        isEmergency={true}
        entries={[debt]}
        outstandingLabel="3 000 FCFA"
        caps={{ flag: false, accrue: false, settle: true, waive: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Annuler (Directeur)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Régler" })).toBeInTheDocument();
  });
});
