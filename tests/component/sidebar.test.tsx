import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/sidebar";
import { renderWithIntl } from "../helpers/render";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

/**
 * Sidebar (06 §5) — French nav + role filtering. Since Phase 5B the items are grouped into labelled
 * sections, so a nav item is queried as a LINK (its own row) rather than by bare text (a section header
 * may share a word with an item, e.g. the "Facturation" section vs the "Facturation" billing link).
 */
describe("Sidebar (06 §5) — French nav + role filtering", () => {
  it("administrateur sees its core module links (grouped, nothing hidden)", () => {
    renderWithIntl(<Sidebar roles={["administrateur"]} />);
    for (const label of ["Tableau de bord", "Patients", "Facturation", "Administration", "Journal d'audit"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("agent d'accueil sees only Tableau de bord + Patients", () => {
    renderWithIntl(<Sidebar roles={["agent_accueil"]} />);
    expect(screen.getByRole("link", { name: "Tableau de bord" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patients" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Facturation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Journal d'audit" })).not.toBeInTheDocument();
  });

  it("caissier sees the Facturation link but not Consultations", () => {
    renderWithIntl(<Sidebar roles={["caissier"]} />);
    expect(screen.getByRole("link", { name: "Facturation" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Consultations" })).not.toBeInTheDocument();
  });

  it("directeur sees Journal d'audit + Administration (read-only, Gate 4)", () => {
    renderWithIntl(<Sidebar roles={["directeur"]} />);
    expect(screen.getByRole("link", { name: "Journal d'audit" })).toBeInTheDocument();
    // Gate 4: the director may READ configuration (config.read), so the nav entry shows;
    // mutation forms remain admin-only (server-side RBAC is the real control).
    expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
  });
});
