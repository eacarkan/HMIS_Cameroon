import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ServiceCatalogueSection,
  type ServiceRow,
} from "@/components/admin/service-catalogue";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/config-actions", () => ({
  createServiceUnitAction: vi.fn(),
  updateServiceUnitAction: vi.fn(),
  setServiceEligibilityAction: vi.fn(),
  deactivateServiceUnitAction: vi.fn(),
  reactivateServiceUnitAction: vi.fn(),
  moveServiceAction: vi.fn(),
}));

const svc: ServiceRow = {
  id: "s1",
  code: "SRV-MED-GEN",
  name: "Médecine générale",
  nameFr: "Médecine générale",
  nameEn: "General Medicine",
  type: "OUTPATIENT",
  displayOrder: 1,
  isActive: true,
  departmentId: null,
  acceptsQueue: true,
  acceptsConsultation: true,
  supportsBilling: true,
  supportsPharmacy: false,
  supportsLab: false,
  supportsImaging: false,
  isInpatientWard: false,
  isEmergency: false,
};

describe("component: ServiceCatalogueSection", () => {
  it("renders a service with its type, code, status and a create form", () => {
    renderWithIntl(
      <ServiceCatalogueSection services={[svc]} departments={[{ id: "d1", name: "Médecine" }]} />,
    );
    expect(screen.getByText("Médecine générale")).toBeInTheDocument();
    expect(screen.getByText("(SRV-MED-GEN)")).toBeInTheDocument();
    // FR serviceType.OUTPATIENT label appears (badge + the type <option>)
    expect(screen.getAllByText("Consultation externe").length).toBeGreaterThanOrEqual(1);
    // create form (accessible-named) + its submit button
    expect(screen.getByRole("button", { name: "Ajouter un service" })).toBeInTheDocument();
    // active status badge
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("shows eligibility badges for the active flags", () => {
    renderWithIntl(<ServiceCatalogueSection services={[svc]} departments={[]} />);
    // "Consultation" and "Facturation" flags are on -> appear at least once (badge/checkbox label)
    expect(screen.getAllByText("Consultation").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Facturation").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the empty state with the create form when there are no services", () => {
    renderWithIntl(<ServiceCatalogueSection services={[]} departments={[]} />);
    expect(screen.getByText("Aucun service configuré.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ajouter un service" })).toBeInTheDocument();
  });
});
