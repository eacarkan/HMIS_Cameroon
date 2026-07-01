import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DuplicateWarning } from "@/components/patients/duplicate-warning";
import { PatientSearchForm } from "@/components/patients/patient-search-form";
import type { PatientDuplicateView } from "@/server/actions/patient-actions";
import { renderWithIntl } from "../helpers/render";

describe("Phase 1A Batch 1A — PatientSearchForm", () => {
  it("renders name, phone, identifier and sex filters", () => {
    renderWithIntl(<PatientSearchForm values={{}} />);
    expect(screen.getByLabelText("Nom, prénom ou n° patient…")).toBeInTheDocument();
    expect(screen.getByLabelText("Téléphone")).toBeInTheDocument();
    expect(screen.getByLabelText("Identifiant")).toBeInTheDocument();
    expect(screen.getByLabelText("Sexe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
  });

  it("preserves current filter values", () => {
    renderWithIntl(
      <PatientSearchForm values={{ q: "BELLO", phone: "699", identifier: "A-1", sex: "female" }} />,
    );
    expect(screen.getByLabelText("Nom, prénom ou n° patient…")).toHaveValue("BELLO");
    expect(screen.getByLabelText("Téléphone")).toHaveValue("699");
    expect(screen.getByLabelText("Identifiant")).toHaveValue("A-1");
  });
});

describe("Phase 1A Batch 1A — DuplicateWarning", () => {
  const candidates: PatientDuplicateView[] = [
    { id: "p1", patientNumber: "HRB-DEMO-P-2026-000001", fullName: "Aïssatou BELLO", basis: "name_dob" },
    { id: "p2", patientNumber: "HRB-DEMO-P-2026-000002", fullName: "Jean MABOU", basis: "phone" },
  ];

  it("surfaces candidates with their basis and an open link — no merge control", () => {
    renderWithIntl(<DuplicateWarning candidates={candidates} />);
    expect(screen.getByText("Doublon possible détecté")).toBeInTheDocument();
    expect(screen.getByText("Aïssatou BELLO")).toBeInTheDocument();
    expect(screen.getByText(/HRB-DEMO-P-2026-000001/)).toBeInTheDocument();
    expect(screen.getByText(/même nom et date de naissance/)).toBeInTheDocument();
    expect(screen.getByText(/même téléphone/)).toBeInTheDocument();
    // Warning/review only — no merge/fusion control anywhere.
    expect(screen.queryByText(/fusionner/i)).not.toBeInTheDocument();
    // Each candidate links to its existing record.
    expect(screen.getAllByRole("link", { name: "Ouvrir" })).toHaveLength(2);
  });

  it("renders nothing when there are no candidates", () => {
    const { container } = renderWithIntl(<DuplicateWarning candidates={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
