import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DecideAdjustmentForms,
  RequestAdjustmentForm,
} from "@/components/pharmacy/adjustment-forms";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/stock-adjustment-actions", () => ({
  requestAdjustmentAction: vi.fn(),
  approveAdjustmentAction: vi.fn(),
  rejectAdjustmentAction: vi.fn(),
}));

describe("Phase 2D-7 — request adjustment form", () => {
  it("renders batch, type, quantity, reason + request button", () => {
    renderWithIntl(
      <RequestAdjustmentForm
        batches={[{ id: "b1", label: "Paracétamol — LOT-PARA-B (exp. 31/12/2026, 200 comprimé)" }]}
      />,
    );
    expect(screen.getByLabelText("Lot")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantité")).toBeRequired();
    expect(screen.getByLabelText("Motif")).toBeRequired();
    expect(screen.getByRole("button", { name: "Demander l'ajustement" })).toBeInTheDocument();
    // All four adjustment types are offered.
    expect(screen.getByRole("option", { name: "Retrait péremption" })).toBeInTheDocument();
  });

  it("shows an empty-state when there are no batches", () => {
    renderWithIntl(<RequestAdjustmentForm batches={[]} />);
    expect(screen.getByText("Aucun lot disponible.")).toBeInTheDocument();
  });
});

describe("Phase 2D-7 — decide adjustment forms", () => {
  it("renders approve and reject controls", () => {
    renderWithIntl(<DecideAdjustmentForms adjustmentId="adj-1" />);
    expect(screen.getByRole("button", { name: "Approuver" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
  });
});
