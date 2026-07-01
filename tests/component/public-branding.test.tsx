import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicDisclaimers } from "@/components/public/public-disclaimers";
import { SanteGridLogo } from "@/components/public/santegrid-logo";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 6A — public SantéGrid branding + mandatory disclaimers render without auth,
 * carry no private/operational data, and cannot be mistaken for production or an
 * official government site.
 */
describe("component: Phase 6A public branding + disclaimers", () => {
  it("renders the SantéGrid wordmark", () => {
    const { container } = renderWithIntl(<SanteGridLogo />);
    expect(container.textContent).toContain("SantéGrid");
  });

  it("shows the synthetic-demonstration disclaimer (no real patient data)", () => {
    renderWithIntl(<PublicDisclaimers />);
    expect(screen.getByText("Démonstration synthétique")).toBeInTheDocument();
    expect(
      screen.getByText(/Aucune donnée réelle de patient n'est utilisée/i),
    ).toBeInTheDocument();
  });

  it("shows the 'not an official government website' disclaimer (not Gate 7, not production)", () => {
    renderWithIntl(<PublicDisclaimers />);
    expect(
      screen.getByText("Ce n'est pas un site officiel du gouvernement"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Gate 7/)).toBeInTheDocument();
  });

  it("contains no operational/patient identifiers", () => {
    const { container } = renderWithIntl(<PublicDisclaimers />);
    // Public disclaimers must not leak numbering or nominative demo data.
    expect(container.textContent).not.toMatch(/HRB-DEMO-[PVFR]-/);
    expect(container.textContent).not.toMatch(/@hrb-demo\.cm/);
  });
});
