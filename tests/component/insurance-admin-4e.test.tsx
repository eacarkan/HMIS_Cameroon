import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClaimActions, CreatePayerForm, LinkCoverageForm } from "@/components/admin/insurance-admin";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/insurance-actions", () => ({
  createPayerAction: vi.fn(),
  createCoverageProfileAction: vi.fn(),
  linkCoverageAction: vi.fn(),
  createClaimAction: vi.fn(),
  transitionClaimAction: vi.fn(),
  decidePreAuthAction: vi.fn(),
  setEligibilityAction: vi.fn(),
}));

describe("Phase 4E — insurance admin forms", () => {
  it("the create-payer form renders code/name/kind", () => {
    renderWithIntl(<CreatePayerForm />);
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un payeur" })).toBeInTheDocument();
  });

  it("the coverage-link form lists the payers", () => {
    renderWithIntl(<LinkCoverageForm payers={[{ id: "p1", label: "CNPS — CNPS" }]} />);
    expect(screen.getByRole("option", { name: "CNPS — CNPS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lier la couverture" })).toBeInTheDocument();
  });

  it("claim actions follow the manual state machine (DRAFT → submit; UNDER_REVIEW → accept/reject)", () => {
    const { unmount } = renderWithIntl(<ClaimActions id="c1" status="DRAFT" />);
    expect(screen.getByRole("button", { name: "Soumettre (placeholder)" })).toBeInTheDocument();
    unmount();
    renderWithIntl(<ClaimActions id="c2" status="UNDER_REVIEW" />);
    expect(screen.getByRole("button", { name: "Accepter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
  });
});
