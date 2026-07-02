import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { PROTOTYPE_LABEL } from "@/lib/constants";
import { renderWithIntl } from "../helpers/render";

describe("PrototypeBanner", () => {
  it("shows the discreet review-environment badge (Phase 6.2)", () => {
    renderWithIntl(<PrototypeBanner />);
    expect(
      screen.getByText(/Environnement de revue — données synthétiques/i),
    ).toBeInTheDocument();
  });

  it("retains the mandatory prototype marker for screen readers + guardrail (R-001)", () => {
    renderWithIntl(<PrototypeBanner />);
    // The formal marker is kept in the DOM (sr-only) so the safeguard stays intact,
    // even though it is no longer the visually dominant wording.
    expect(screen.getByText(PROTOTYPE_LABEL)).toBeInTheDocument();
    expect(
      screen.getByText(/non destiné à la production/i),
    ).toBeInTheDocument();
  });
});
