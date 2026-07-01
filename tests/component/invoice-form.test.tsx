import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InvoiceForm } from "@/components/billing/invoice-form";
import { renderWithIntl } from "../helpers/render";

// Mock the billing action so the client form renders without loading server code.
vi.mock("@/server/actions/billing-actions", () => ({
  createInvoiceAction: vi.fn(),
}));

describe("Gate 4 — InvoiceForm (DB-driven tariff catalogue)", () => {
  const tariffs = [
    { code: "consultation_generale", label: "Consultation médecine générale", amount: 2000 },
    { code: "ouverture_dossier", label: "Frais d'ouverture de dossier", amount: 1000 },
  ];

  it("displays DB-sourced active tariffs (label + amount + per-tariff qty input)", () => {
    renderWithIntl(<InvoiceForm encounterId="e1" tariffs={tariffs} />);
    expect(screen.getByText("Consultation médecine générale")).toBeInTheDocument();
    expect(screen.getByText("Frais d'ouverture de dossier")).toBeInTheDocument();
    // The unit price comes straight from the tariff (FCFA uses a narrow no-break space).
    expect(screen.getAllByText(/FCFA/).length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('input[name="qty_consultation_generale"]')).not.toBeNull();
    expect(document.querySelector('input[name="qty_ouverture_dossier"]')).not.toBeNull();
  });

  it("shows a clear message when there is no active tariff (no static catalogue)", () => {
    renderWithIntl(<InvoiceForm encounterId="e1" tariffs={[]} />);
    expect(screen.getByText(/Aucun tarif actif/)).toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });
});
