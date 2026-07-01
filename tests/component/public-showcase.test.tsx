import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicShowcase } from "@/components/public/public-showcase";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 6B — the public feature showcase renders the modules + proof without auth,
 * exposes NO write actions, and leaks NO patient/operational identifiers or source.
 */
describe("component: Phase 6B public feature showcase", () => {
  it("renders module preview cards", () => {
    renderWithIntl(<PublicShowcase />);
    expect(screen.getByText("Facturation & caisse")).toBeInTheDocument();
    expect(screen.getByText("Pharmacie & stock")).toBeInTheDocument();
    expect(screen.getByText("Sécurité, audit & rôles")).toBeInTheDocument();
    expect(
      screen.getByText("Multi-hôpitaux & supervision centrale"),
    ).toBeInTheDocument();
  });

  it("renders the banker/accountant proof section and the readiness boundary", () => {
    renderWithIntl(<PublicShowcase />);
    expect(
      screen.getByText("Une plateforme réelle, déployée et vérifiée"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/hors Gate 7 · aucune donnée réelle/i),
    ).toBeInTheDocument();
  });

  it("exposes no write actions (no forms, no submit buttons) and no patient identifiers", () => {
    const { container } = renderWithIntl(<PublicShowcase />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(container.textContent).not.toMatch(/HRB-DEMO-[PVFR]-/);
    expect(container.textContent).not.toMatch(/@hrb-demo\.cm/);
  });
});
