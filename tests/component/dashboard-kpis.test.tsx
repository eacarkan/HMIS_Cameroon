import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import type { DashboardSummary } from "@/server/services";
import { renderWithIntl } from "../helpers/render";

function summary(over: Partial<DashboardSummary>): DashboardSummary {
  return {
    sections: { activity: true, clinical: false, billing: false, management: false },
    patientsToday: 1,
    openEncounters: 1,
    encountersOpenedToday: 1,
    encountersClosedToday: 0,
    consultationsToday: 2,
    invoicesToday: 1,
    collectionsToday: 3000,
    byMethod: [{ method: "cash", methodLabel: "espèces", total: 3000, count: 1 }],
    recent: [],
    ...over,
  };
}

describe("Phase 1A Batch 5 — DashboardKpis (role-specific)", () => {
  it("reception sees activity only — no clinical or billing sections", () => {
    renderWithIntl(<DashboardKpis summary={summary({})} />);
    expect(screen.getByText("Activité du jour")).toBeInTheDocument();
    expect(screen.queryByText("Activité clinique")).not.toBeInTheDocument();
    expect(screen.queryByText("Facturation & caisse")).not.toBeInTheDocument();
  });

  it("cashier sees the billing section with collections", () => {
    renderWithIntl(
      <DashboardKpis
        summary={summary({
          sections: { activity: true, clinical: false, billing: true, management: false },
        })}
      />,
    );
    expect(screen.getByText("Facturation & caisse")).toBeInTheDocument();
    expect(screen.getByText("Encaissements du jour")).toBeInTheDocument();
  });

  it("doctor sees the clinical section", () => {
    renderWithIntl(
      <DashboardKpis
        summary={summary({
          sections: { activity: true, clinical: true, billing: false, management: false },
        })}
      />,
    );
    expect(screen.getByText("Activité clinique")).toBeInTheDocument();
    expect(screen.getByText("Consultations du jour")).toBeInTheDocument();
  });
});
