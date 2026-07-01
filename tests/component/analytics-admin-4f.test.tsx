import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateDefinitionForm, ExportRunActions, RunForm } from "@/components/admin/analytics-admin";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/analytics-actions", () => ({
  createDefinitionAction: vi.fn(),
  toggleDefinitionAction: vi.fn(),
  runReportAction: vi.fn(),
  exportRunAction: vi.fn(),
}));

describe("Phase 4F — analytics admin forms", () => {
  it("the create-definition form lists every report kind", () => {
    renderWithIntl(<CreateDefinitionForm />);
    expect(screen.getByRole("option", { name: "Synthèse opérationnelle" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Top diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Recettes par mode" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Âge / sexe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer une définition" })).toBeInTheDocument();
  });

  it("the run form offers on-demand + scheduled-placeholder triggers", () => {
    renderWithIntl(<RunForm definitionId="d1" />);
    expect(screen.getByRole("option", { name: "À la demande" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Planifié (placeholder)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exécuter" })).toBeInTheDocument();
  });

  it("the export actions offer CSV + JSON", () => {
    renderWithIntl(<ExportRunActions runId="r1" />);
    expect(screen.getByRole("button", { name: "Exporter CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exporter JSON" })).toBeInTheDocument();
  });
});
