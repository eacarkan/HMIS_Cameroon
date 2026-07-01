import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PatientForm } from "@/components/patients/patient-form";
import { TemporaryPatientForm } from "@/components/patients/temporary-patient-form";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/patient-actions", () => ({
  createPatientAction: vi.fn(),
  createTemporaryPatientAction: vi.fn(),
  correctPatientIdentityAction: vi.fn(),
}));

describe("component: Phase 2B identity forms", () => {
  it("registration form exposes guardian phone + estimated age", () => {
    renderWithIntl(<PatientForm />);
    expect(screen.getByText("Téléphone du tuteur/parent")).toBeInTheDocument();
    expect(screen.getByText("Âge estimé")).toBeInTheDocument();
  });

  it("temporary-patient form asks for apparent sex (explicit workflow, no free-typed name)", () => {
    renderWithIntl(<TemporaryPatientForm />);
    expect(screen.getByText("Sexe (apparent)")).toBeInTheDocument();
    expect(screen.queryByText("Nom")).not.toBeInTheDocument();
  });
});
