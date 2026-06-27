import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Topbar } from "@/components/layout/topbar";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/auth/actions", () => ({
  selectHospitalAction: vi.fn(),
  signOutAction: vi.fn(),
}));

const actor = {
  id: "user-solange-abena",
  displayName: "Solange ABENA",
  email: "solange.abena@hrb-demo.cm",
  roles: ["caissier"],
  hospitalIds: ["hosp-hrb-demo"],
  hospitalId: "hosp-hrb-demo",
  hospitalCode: "HRB-DEMO",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
};

const hospital = {
  hospitalId: "hosp-hrb-demo",
  code: "HRB-DEMO",
  name: "Hôpital Régional de Bertoua — Démo",
  region: "Est",
};

describe("Topbar (06 §5)", () => {
  it("renders hospital context, user, role and language", () => {
    renderWithIntl(
      <Topbar
        actor={actor}
        hospital={hospital}
        hospitals={[
          { id: "hosp-hrb-demo", code: "HRB-DEMO", name: hospital.name },
        ]}
      />,
    );
    expect(screen.getByText("Hôpital actif")).toBeInTheDocument();
    expect(
      screen.getAllByText("Hôpital Régional de Bertoua — Démo").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("HRB-DEMO").length).toBeGreaterThan(0);
    expect(screen.getByText("Solange ABENA")).toBeInTheDocument();
    expect(screen.getAllByText("Caissier").length).toBeGreaterThan(0);
    expect(screen.getByText("FR")).toBeInTheDocument();
  });
});
