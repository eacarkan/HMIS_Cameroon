import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppError from "@/app/(app)/error";
import { renderWithIntl } from "../helpers/render";

describe("Phase 1A Batch 6 — app error boundary", () => {
  it("shows a calm French message + retry, never the raw error", () => {
    const reset = vi.fn();
    renderWithIntl(<AppError error={new Error("boom-internal-detail")} reset={reset} />);
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    // The internal error text is not leaked to the user.
    expect(screen.queryByText(/boom-internal-detail/)).not.toBeInTheDocument();
  });
});
