import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoAccountDirectory } from "@/components/public/demo-account-directory";
import { renderWithIntl } from "../helpers/render";

/**
 * Phase 6C — the public demo directory lists synthetic accounts with their access mode,
 * shows the password only as the operator-provided hint/placeholder (never the literal
 * committed password), and marks sensitive roles credential-only.
 */
const PLACEHOLDER = "(fourni par l'opérateur — voir le runbook)";

describe("component: Phase 6C demo account directory", () => {
  it("lists synthetic accounts with roles and sign-in ids", () => {
    renderWithIntl(<DemoAccountDirectory passwordHint={PLACEHOLDER} />);
    expect(screen.getByText("Caissier (Bertoua)")).toBeInTheDocument();
    expect(screen.getByText("Superviseur central")).toBeInTheDocument();
    expect(screen.getByText("solange.abena@hrb-demo.cm")).toBeInTheDocument();
  });

  it("marks one-click vs credential-only access", () => {
    renderWithIntl(<DemoAccountDirectory passwordHint={PLACEHOLDER} />);
    expect(screen.getAllByText("Un clic").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Identifiants").length).toBeGreaterThan(0);
  });

  it("shows only the password hint/placeholder (no committed/real password)", () => {
    const { container } = renderWithIntl(
      <DemoAccountDirectory passwordHint={PLACEHOLDER} />,
    );
    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
    // The directory renders only the supplied hint — never a shared demo password value.
    expect(container.textContent).not.toContain("synthetic-demo-shared-pw");
  });
});
