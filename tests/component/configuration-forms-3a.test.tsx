import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApplyTemplateForm,
  RecomputeButton,
  OverrideSettingForm,
} from "@/components/admin/configuration-forms";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/configuration-actions", () => ({
  applyTemplateAction: vi.fn(),
  recomputeCompletenessAction: vi.fn(),
  overrideInstanceSettingAction: vi.fn(),
}));

describe("Phase 3A — apply-template form", () => {
  it("renders a template picker with each template and the apply button", () => {
    renderWithIntl(
      <ApplyTemplateForm
        templates={[
          { id: "t1", code: "TPL-BERTOUA-REF", name: "Modèle de référence — Bertoua", version: 1 },
        ]}
      />,
    );
    expect(screen.getByLabelText("Modèle")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Modèle de référence — Bertoua (TPL-BERTOUA-REF v1)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeInTheDocument();
  });
});

describe("Phase 3A — recompute + override controls", () => {
  it("renders the recompute button", () => {
    renderWithIntl(<RecomputeButton />);
    expect(screen.getByRole("button", { name: "Recalculer" })).toBeInTheDocument();
  });

  it("renders the instance-override setting form", () => {
    renderWithIntl(<OverrideSettingForm />);
    expect(screen.getByLabelText("Clé du paramètre")).toBeRequired();
    expect(screen.getByLabelText("Valeur")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
  });
});
