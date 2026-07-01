import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectorForm, CreateSystemForm } from "@/components/admin/integration-admin";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/integration-actions", () => ({
  createExternalSystemAction: vi.fn(),
  configureConnectorAction: vi.fn(),
  addCredentialReferenceAction: vi.fn(),
  setExternalSystemConfigAction: vi.fn(),
  setExternalSystemStatusAction: vi.fn(),
  runJobAction: vi.fn(),
  retryJobAction: vi.fn(),
}));

describe("Phase 4A — integration admin forms", () => {
  it("the create-system form renders the registry fields", () => {
    renderWithIntl(<CreateSystemForm />);
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un système externe" })).toBeInTheDocument();
  });

  it("the connector form offers ONLY mock/sandbox/production-disabled environments (no live production)", () => {
    renderWithIntl(<ConnectorForm systemId="sys-1" />);
    expect(screen.getByRole("option", { name: "MOCK" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SANDBOX" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PRODUCTION_DISABLED" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "PRODUCTION" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer le connecteur" })).toBeInTheDocument();
  });
});
