import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EncounterServiceForm,
  EncounterStatusControls,
} from "@/components/encounters/encounter-lifecycle";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import type { TimelineEvent } from "@/lib/patient-timeline";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/encounter-actions", () => ({
  changeEncounterStatusAction: vi.fn(),
  assignEncounterServiceAction: vi.fn(),
}));

describe("Phase 1A Batch 1B — EncounterStatusControls", () => {
  it("offers close + cancel while the encounter is open", () => {
    renderWithIntl(<EncounterStatusControls encounterId="e1" status="open" />);
    expect(screen.getByRole("button", { name: "Clôturer la visite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler la visite" })).toBeInTheDocument();
  });

  it("shows a terminal notice (no controls) once closed", () => {
    renderWithIntl(<EncounterStatusControls encounterId="e1" status="closed" />);
    expect(screen.queryByRole("button", { name: "Clôturer la visite" })).not.toBeInTheDocument();
    expect(screen.getByText(/aucune autre transition possible/i)).toBeInTheDocument();
  });
});

describe("Phase 1A Batch 1B / Phase 2 QA — EncounterServiceForm", () => {
  it("offers a RESTRICTED outpatient dropdown defaulting to the current service", () => {
    renderWithIntl(
      <EncounterServiceForm
        encounterId="e1"
        current="Médecine générale"
        services={["Médecine générale", "Pédiatrie", "Chirurgie"]}
      />,
    );
    const select = screen.getByLabelText(/Affecter au service/);
    expect(select).toHaveValue("Médecine générale");
    // Only the provided outpatient consultation services are offered — no free-text input, and
    // no support/inpatient services (the server enforces the same rule).
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Médecine générale", "Pédiatrie", "Chirurgie"]);
    expect(options).not.toContain("Caisse");
    expect(screen.getByRole("button", { name: "Affecter" })).toBeInTheDocument();
  });
});

describe("Phase 1A Batch 1B — PatientTimeline", () => {
  const events: TimelineEvent[] = [
    { at: "2026-06-27T11:00:00.000Z", type: "encounter_closed", ref: "HRB-DEMO-V-2026-000001" },
    { at: "2026-06-27T08:00:00.000Z", type: "patient_registered", ref: null },
  ];

  it("renders chronological events with French labels", () => {
    renderWithIntl(<PatientTimeline events={events} />);
    expect(screen.getByText("Visite clôturée")).toBeInTheDocument();
    expect(screen.getByText("Patient enregistré")).toBeInTheDocument();
    expect(screen.getByText("HRB-DEMO-V-2026-000001")).toBeInTheDocument();
  });

  it("shows an empty state with no events", () => {
    renderWithIntl(<PatientTimeline events={[]} />);
    expect(screen.getByText(/Aucun événement/)).toBeInTheDocument();
  });
});
