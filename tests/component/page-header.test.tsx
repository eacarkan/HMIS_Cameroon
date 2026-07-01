import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/layout/page-header";

describe("PageHeader", () => {
  it("renders title, description and a right-aligned action", () => {
    render(
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble"
        actions={<button>Créer un patient</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Tableau de bord" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vue d'ensemble")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Créer un patient" }),
    ).toBeInTheDocument();
  });
});
