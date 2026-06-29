import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AmendConsultationForm,
  FinalizeConsultationButton,
} from "@/components/consultations/consultation-controls";
import {
  ConsultationNoteDocument,
  type ConsultationNoteData,
} from "@/components/print/consultation-note-document";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/consultation-actions", () => ({
  finalizeConsultationAction: vi.fn(),
  amendConsultationAction: vi.fn(),
}));

const noteData: ConsultationNoteData = {
  consultationId: "c1",
  encounterNumber: "HRB-DEMO-V-2026-000001",
  patientName: "Aïssatou BELLO",
  patientNumber: "HRB-DEMO-P-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  clinician: "Dr Jean-Paul ETOA",
  dateLabel: "27/06/2026 09:40",
  statusLabel: "Finalisée",
  reason: "Fièvre",
  vitals: "Température 38,2 °C",
  clinicalNote: "État général conservé.",
  provisionalDiagnosis: "Syndrome fébrile",
  recommendation: "Repos.",
  observations: [{ type: "Température", value: "38.2", unit: "°C" }],
  diagnoses: [{ label: "Syndrome fébrile", code: "R50.9", isPrimary: true }],
};

describe("Phase 1A Batch 2 — ConsultationNoteDocument", () => {
  it("renders the institutional note with patient context, structured data, and prototype label", () => {
    renderWithIntl(<ConsultationNoteDocument data={noteData} />);
    expect(screen.getByText("Compte rendu de consultation")).toBeInTheDocument();
    expect(screen.getByText("Aïssatou BELLO")).toBeInTheDocument();
    expect(screen.getByText("HRB-DEMO-V-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Syndrome fébrile")).toBeInTheDocument();
    expect(screen.getByText(/non destiné à la production/i)).toBeInTheDocument();
    // No prescription/order section.
    expect(screen.queryByText(/ordonnance|prescription/i)).not.toBeInTheDocument();
  });
});

describe("Phase 1A Batch 2 — consultation controls", () => {
  it("finalize button is shown for a draft", () => {
    renderWithIntl(<FinalizeConsultationButton consultationId="c1" />);
    expect(screen.getByRole("button", { name: "Finaliser la consultation" })).toBeInTheDocument();
  });

  it("amend form prefills the finalized note's fields", () => {
    renderWithIntl(
      <AmendConsultationForm
        consultationId="c1"
        values={{
          clinicalNote: "État général conservé.",
          vitals: "T 38,2",
          provisionalDiagnosis: "Syndrome fébrile",
          recommendation: "Repos.",
        }}
      />,
    );
    expect(screen.getByDisplayValue("État général conservé.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer l'amendement" })).toBeInTheDocument();
  });
});
