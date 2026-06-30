import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DiagnosticOrderActions,
  type DiagnosticOrderRow,
} from "@/components/diagnostics/diagnostic-order-actions";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/diagnostic-actions", () => ({
  confirmDiagnosticPaymentAction: vi.fn(),
  startDiagnosticAction: vi.fn(),
  enterDiagnosticResultAction: vi.fn(),
  validateDiagnosticResultAction: vi.fn(),
}));

const allCaps = { pay: true, enter: true, validate: true };
const base: DiagnosticOrderRow = {
  id: "o1",
  encounterId: "e1",
  orderNumber: "HRB-DEMO-E-2026-000001",
  modality: "lab",
  itemLabel: "Numération formule sanguine (NFS)",
  status: "requested",
  isPaid: false,
  priceLabel: "3 500 FCFA",
  resultText: null,
  cancelReason: null,
};

describe("Phase 2I — diagnostic order actions", () => {
  it("a requested order offers payment confirmation to the cashier", () => {
    renderWithIntl(<DiagnosticOrderActions order={base} caps={{ pay: true, enter: false, validate: false }} path="/x" />);
    expect(screen.getByRole("button", { name: "Confirmer le paiement" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
  });

  it("an in-progress order offers the result entry form to the technician", () => {
    renderWithIntl(
      <DiagnosticOrderActions order={{ ...base, status: "in_progress", isPaid: true }} caps={{ pay: false, enter: true, validate: false }} path="/x" />,
    );
    expect(screen.getByRole("button", { name: "Enregistrer le résultat" })).toBeInTheDocument();
  });

  it("at result_entered with NO result text (doctor view), shows the awaiting-validation notice, no result", () => {
    renderWithIntl(
      <DiagnosticOrderActions order={{ ...base, status: "result_entered", resultText: null }} caps={{ pay: false, enter: false, validate: false }} path="/x" />,
    );
    expect(screen.getByText(/en attente de validation/)).toBeInTheDocument();
  });

  it("at result_entered WITH result text (staff view), shows the result + the validate button", () => {
    renderWithIntl(
      <DiagnosticOrderActions
        order={{ ...base, status: "result_entered", resultText: "Hb 12,5 g/dL" }}
        caps={{ pay: false, enter: false, validate: true }}
        path="/x"
      />,
    );
    expect(screen.getByText("Hb 12,5 g/dL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider" })).toBeInTheDocument();
  });

  it("a validated order shows the result and the print-report link", () => {
    renderWithIntl(
      <DiagnosticOrderActions
        order={{ ...base, status: "validated", isPaid: true, resultText: "Normal" }}
        caps={allCaps}
        path="/x"
      />,
    );
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Imprimer le compte rendu" })).toBeInTheDocument();
  });
});
