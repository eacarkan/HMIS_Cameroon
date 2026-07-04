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

  it("renders the banker/accountant proof section and the positive RC readiness line", () => {
    renderWithIntl(<PublicShowcase />);
    expect(
      screen.getByText("Environnement de revue en ligne et vérifié"),
    ).toBeInTheDocument();
    // 6.5B mentor correction — ONE positive RC statement; the defensive boundary
    // wording (Gate 7 / "not for production" / no-real-data) must NOT appear on the
    // public showcase card.
    expect(
      screen.getByText(
        "Logiciel préparé comme version candidate (RC) sur données synthétiques.",
      ),
    ).toBeInTheDocument();
    const main = screen.getByText("Périmètre & préparation").closest("section");
    expect(main?.textContent).not.toMatch(/Gate 7|production|donnée réelle/i);
  });

  it("exposes no write actions (no forms, no submit buttons) and no patient identifiers", () => {
    const { container } = renderWithIntl(<PublicShowcase />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(container.textContent).not.toMatch(/HRB-DEMO-[PVFR]-/);
    expect(container.textContent).not.toMatch(/@hrb-demo\.cm/);
  });
});
