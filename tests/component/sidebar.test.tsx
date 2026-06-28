import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/sidebar";
import { renderWithIntl } from "../helpers/render";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("Sidebar (06 §5) — French nav + role filtering", () => {
  it("administrateur sees all six modules", () => {
    renderWithIntl(<Sidebar roles={["administrateur"]} />);
    for (const label of [
      "Tableau de bord",
      "Patients",
      "Consultations",
      "Facturation",
      "Administration",
      "Journal d'audit",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("agent d'accueil sees only Tableau de bord + Patients", () => {
    renderWithIntl(<Sidebar roles={["agent_accueil"]} />);
    expect(screen.getByText("Tableau de bord")).toBeInTheDocument();
    expect(screen.getByText("Patients")).toBeInTheDocument();
    expect(screen.queryByText("Facturation")).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    expect(screen.queryByText("Journal d'audit")).not.toBeInTheDocument();
  });

  it("caissier sees Facturation but not Consultations", () => {
    renderWithIntl(<Sidebar roles={["caissier"]} />);
    expect(screen.getByText("Facturation")).toBeInTheDocument();
    expect(screen.queryByText("Consultations")).not.toBeInTheDocument();
  });

  it("directeur sees Journal d'audit + Administration (read-only, Gate 4)", () => {
    renderWithIntl(<Sidebar roles={["directeur"]} />);
    expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
    // Gate 4: the director may READ configuration (config.read), so the nav entry shows;
    // mutation forms remain admin-only (server-side RBAC is the real control).
    expect(screen.getByText("Administration")).toBeInTheDocument();
  });
});
