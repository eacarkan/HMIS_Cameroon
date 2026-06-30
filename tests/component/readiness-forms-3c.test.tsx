import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReadinessItemForm } from "@/components/admin/readiness-forms";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/readiness-actions", () => ({
  setReadinessItemAction: vi.fn(),
}));

describe("Phase 3C — readiness item form", () => {
  it("renders the status options, fields, and the supplier-dependent marker", () => {
    renderWithIntl(
      <ReadinessItemForm
        category="hardware"
        label="Matériel (postes, serveur)"
        supplierDependent
        status="needs_validation"
        owner={null}
        evidenceNote={null}
        verifier={null}
      />,
    );
    expect(screen.getByText("(dépend d'un fournisseur)")).toBeInTheDocument();
    expect(screen.getByText("Statut")).toBeInTheDocument();
    // The six readiness statuses are offered (French labels).
    expect(screen.getByRole("option", { name: "Prêt" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "À valider" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bloqué" })).toBeInTheDocument();
    expect(screen.getByText("Vérificateur")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });
});
