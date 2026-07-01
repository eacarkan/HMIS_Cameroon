import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddMappingForm, CreateMappingSetForm } from "@/components/admin/dhis2-admin";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/dhis2-actions", () => ({
  createMappingSetAction: vi.fn(),
  upsertMappingAction: vi.fn(),
  runMockApiExportAction: vi.fn(),
}));

describe("Phase 4B — DHIS2 admin forms", () => {
  it("the create-mapping-set form renders the placeholder fields", () => {
    renderWithIntl(<CreateMappingSetForm />);
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Org-unit (placeholder)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un jeu de correspondances" })).toBeInTheDocument();
  });

  it("the add-mapping form maps a local element to a DHIS2 placeholder", () => {
    renderWithIntl(<AddMappingForm mappingSetId="set-1" />);
    expect(screen.getByText("Élément local")).toBeInTheDocument();
    expect(screen.getByText("Élément de données (placeholder)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter une correspondance" })).toBeInTheDocument();
  });
});
