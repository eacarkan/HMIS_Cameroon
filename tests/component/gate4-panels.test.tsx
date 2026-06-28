import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClinicalStructurePanel } from "@/components/consultations/clinical-structure-panel";
import { PatientIdentityPanel } from "@/components/patients/patient-identity-panel";
import { renderWithIntl } from "../helpers/render";

// Mock the server-action modules so these client components render without loading
// server-only code. The actions are not invoked here — we assert rendering + RBAC hiding.
vi.mock("@/server/actions/patient-identity-actions", () => ({
  addPatientContactAction: vi.fn(),
  deactivatePatientContactAction: vi.fn(),
  addPatientIdentifierAction: vi.fn(),
  deactivatePatientIdentifierAction: vi.fn(),
  reviewDuplicateCandidateAction: vi.fn(),
}));
vi.mock("@/server/actions/clinical-structure-actions", () => ({
  addObservationAction: vi.fn(),
  addDiagnosisAction: vi.fn(),
}));

const contacts = [{ id: "c1", contactType: "phone", value: "+237 6 99 00 00 01", label: null }];
const identifiers = [
  { id: "i1", identifierType: "carte_hospitaliere", value: "A-1", issuingAuthority: null },
];
const duplicates = [{ id: "d1", matchBasis: "name+dob+phone", status: "open" }];

describe("Gate 4 — PatientIdentityPanel (25 §7)", () => {
  it("reception (canManage) sees data, add forms and the no-merge notice — but no merge control", () => {
    renderWithIntl(
      <PatientIdentityPanel
        patientId="p1"
        contacts={contacts}
        identifiers={identifiers}
        duplicates={duplicates}
        canManage
      />,
    );
    expect(screen.getByText("+237 6 99 00 00 01")).toBeInTheDocument();
    expect(screen.getByText("A-1")).toBeInTheDocument();
    expect(screen.getByText("Ajouter un contact")).toBeInTheDocument();
    expect(screen.getByText("Ajouter un identifiant")).toBeInTheDocument();
    // Duplicate is warning/review only — dismiss exists, NO merge/MPI control.
    expect(screen.getByText("Écarter")).toBeInTheDocument();
    expect(screen.getByText(/aucune fusion/i)).toBeInTheDocument();
    expect(screen.queryByText(/fusionner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MPI/i)).not.toBeInTheDocument();
  });

  it("read-only role (canManage=false) sees data but no mutate controls", () => {
    renderWithIntl(
      <PatientIdentityPanel
        patientId="p1"
        contacts={contacts}
        identifiers={identifiers}
        duplicates={duplicates}
        canManage={false}
      />,
    );
    expect(screen.getByText("+237 6 99 00 00 01")).toBeInTheDocument();
    expect(screen.queryByText("Ajouter un contact")).not.toBeInTheDocument();
    expect(screen.queryByText("Ajouter un identifiant")).not.toBeInTheDocument();
    expect(screen.queryByText("Désactiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Écarter")).not.toBeInTheDocument();
  });
});

describe("Gate 4 — ClinicalStructurePanel (25 §8)", () => {
  const observations = [{ id: "o1", type: "temperature", value: "38.2", unit: "°C" }];
  const diagnoses = [{ id: "dx1", label: "Syndrome fébrile", code: "R50.9", isPrimary: true }];

  it("clinician (canManage) sees structured data and add forms", () => {
    renderWithIntl(
      <ClinicalStructurePanel
        encounterId="e1"
        consultationId="cs1"
        observations={observations}
        diagnoses={diagnoses}
        canManage
      />,
    );
    expect(screen.getByText("Syndrome fébrile")).toBeInTheDocument();
    expect(screen.getByText("Ajouter une constante")).toBeInTheDocument();
    expect(screen.getByText("Ajouter un diagnostic")).toBeInTheDocument();
  });

  it("non-clinician reader (canManage=false) sees data but no add forms", () => {
    renderWithIntl(
      <ClinicalStructurePanel
        encounterId="e1"
        consultationId="cs1"
        observations={observations}
        diagnoses={diagnoses}
        canManage={false}
      />,
    );
    expect(screen.getByText("Syndrome fébrile")).toBeInTheDocument();
    expect(screen.queryByText("Ajouter une constante")).not.toBeInTheDocument();
    expect(screen.queryByText("Ajouter un diagnostic")).not.toBeInTheDocument();
  });
});
