import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrescriptionEditor } from "@/components/prescriptions/prescription-editor";
import {
  PrescriptionDocument,
  type PrescriptionData,
} from "@/components/print/prescription-document";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/prescription-actions", () => ({
  createPrescriptionAction: vi.fn(),
  finalizePrescriptionAction: vi.fn(),
  sendPrescriptionAction: vi.fn(),
  cancelPrescriptionAction: vi.fn(),
}));

const meds = [
  { id: "m1", label: "Paracétamol 500 mg" },
  { id: "m2", label: "Amoxicilline 500 mg" },
];

const data: PrescriptionData = {
  prescriptionNumber: "HRB-DEMO-O-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  patientName: "Aïssatou BELLO",
  patientNumber: "HRB-DEMO-P-2026-000001",
  doctorName: "Dr Jean-Paul ETOA",
  statusLabel: "Finalisée",
  dateLabel: "30/06/2026 09:00",
  notes: "Repos",
  items: [
    {
      medicationLabel: "Paracétamol 500 mg",
      unit: "comprimé",
      dosage: "1 comprimé",
      frequency: "3x/jour",
      duration: "5 jours",
      quantity: 15,
      instructions: "après les repas",
    },
  ],
};

describe("Phase 2D-2 — prescription editor", () => {
  it("renders an item row with medication select + fields + add/create buttons", () => {
    renderWithIntl(<PrescriptionEditor encounterId="enc1" medications={meds} />);
    expect(screen.getByRole("option", { name: "Paracétamol 500 mg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer l'ordonnance" })).toBeInTheDocument();
  });
});

describe("Phase 2D-2 — prescription print document", () => {
  it("renders the tracking number, prescribed line, doctor signature space + synthetic marker", () => {
    renderWithIntl(<PrescriptionDocument data={data} />);
    expect(screen.getByText("HRB-DEMO-O-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Paracétamol 500 mg")).toBeInTheDocument();
    expect(screen.getByText(/Signature \/ cachet du médecin/)).toBeInTheDocument();
    expect(screen.getByText(/prototype|démonstration|fictif/i)).toBeInTheDocument();
  });
});
