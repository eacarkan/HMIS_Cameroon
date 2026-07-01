import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateMedicationForm } from "@/components/admin/medication-forms";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/medication-actions", () => ({
  createMedicationAction: vi.fn(),
  deactivateMedicationAction: vi.fn(),
  reactivateMedicationAction: vi.fn(),
}));

describe("Phase 2D-1 — medication catalogue form", () => {
  it("renders code, bilingual names, galenic form, unit and an add button", () => {
    renderWithIntl(<CreateMedicationForm />);
    expect(screen.getByLabelText("Code")).toBeRequired();
    expect(screen.getByLabelText("Nom (FR)")).toBeRequired();
    expect(screen.getByLabelText("Nom (EN)")).toBeRequired();
    expect(screen.getByLabelText("Forme galénique")).toBeInTheDocument();
    expect(screen.getByLabelText("Unité")).toBeRequired();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeInTheDocument();
    // The galenic-form select offers the suggested forms.
    expect(screen.getByRole("option", { name: "Comprimé" })).toBeInTheDocument();
  });
});
