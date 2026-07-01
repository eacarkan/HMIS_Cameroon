import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicFeedback } from "@/components/public/public-feedback";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 6F — the feedback flow is EMAIL ONLY: a prominent no-patient-data warning,
 * issue categories, and (when configured) a mailto link — with NO in-app form, NO
 * inputs and NO submit button.
 */
describe("component: Phase 6F stakeholder feedback (email only)", () => {
  it("shows the no-patient-data warning and the categories", () => {
    renderWithIntl(<PublicFeedback email={null} />);
    expect(
      screen.getByText(/N'incluez aucune donnée réelle ou sensible de patient/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Anomalie / bug")).toBeInTheDocument();
    expect(screen.getByText("Suggestion de fonctionnalité")).toBeInTheDocument();
  });

  it("has NO in-app form, no inputs and no submit button", () => {
    const { container } = renderWithIntl(<PublicFeedback email={null} />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    // With no configured address, a placeholder is shown (no mailto link).
    expect(screen.getByText("(à définir par l'opérateur)")).toBeInTheDocument();
  });

  it("renders a mailto link when a feedback email is configured", () => {
    renderWithIntl(<PublicFeedback email="retour@example.test" />);
    const link = screen.getByRole("link", { name: /retour@example\.test/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("mailto:retour@example.test"));
  });
});
