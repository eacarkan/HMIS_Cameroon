import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionForm, GenerateCandidatesForm, MockMpiForm } from "@/components/patients/match-review";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/patient-match-actions", () => ({
  generateCandidatesAction: vi.fn(),
  startReviewAction: vi.fn(),
  recordDecisionAction: vi.fn(),
  mockMpiCheckAction: vi.fn(),
}));

describe("Phase 4G — patient-match review forms", () => {
  it("the generate form renders the warning-only action", () => {
    renderWithIntl(<GenerateCandidatesForm />);
    expect(screen.getByRole("button", { name: "Générer les candidats" })).toBeInTheDocument();
  });

  it("the decision form requires a reason and offers the manual outcomes + a no-merge notice", () => {
    renderWithIntl(<DecisionForm id="c1" />);
    const reason = screen.getByPlaceholderText("Justification de la décision (obligatoire)");
    expect(reason).toBeRequired();
    expect(screen.getByRole("button", { name: "Marquer doublon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marquer non-doublon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Écarter" })).toBeInTheDocument();
    expect(screen.getByText(/aucune fusion automatique/i)).toBeInTheDocument();
  });

  it("the mock-MPI form is clearly a fictitious check", () => {
    renderWithIntl(<MockMpiForm id="c1" />);
    expect(screen.getByRole("button", { name: "Vérifier MPI (fictif)" })).toBeInTheDocument();
  });
});
