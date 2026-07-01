import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImportForm, ReviewForm } from "@/components/admin/external-result-import";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/external-result-actions", () => ({
  importResultsAction: vi.fn(),
  reviewResultAction: vi.fn(),
}));

describe("Phase 4C — external-result import forms", () => {
  it("the import form renders the source + CSV fields", () => {
    renderWithIntl(<ImportForm />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("CSV (en-tête + lignes)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer" })).toBeInTheDocument();
  });

  it("the review form offers promote + reject when an order is matched", () => {
    renderWithIntl(<ReviewForm id="imp-1" canPromote />);
    expect(screen.getByRole("button", { name: "Promouvoir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
  });

  it("the review form offers only reject when no order is matched", () => {
    renderWithIntl(<ReviewForm id="imp-2" canPromote={false} />);
    expect(screen.queryByRole("button", { name: "Promouvoir" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
  });
});
