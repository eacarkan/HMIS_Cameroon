import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ReceiveStockForm,
  ReleaseStaleReservationsButton,
} from "@/components/pharmacy/stock-forms";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/stock-actions", () => ({
  receiveStockBatchAction: vi.fn(),
  releaseStaleReservationsAction: vi.fn(),
}));

describe("Phase 2D-3 — receive stock form", () => {
  it("renders medication, batch number, expiry, quantity + receive button", () => {
    renderWithIntl(
      <ReceiveStockForm medications={[{ id: "m1", label: "Paracétamol 500 mg" }]} />,
    );
    expect(screen.getByLabelText("Médicament")).toBeInTheDocument();
    expect(screen.getByLabelText("N° de lot")).toBeRequired();
    expect(screen.getByLabelText("Péremption")).toBeRequired();
    expect(screen.getByLabelText("Quantité")).toBeRequired();
    expect(screen.getByRole("button", { name: "Réceptionner" })).toBeInTheDocument();
  });
});

describe("Phase 2D-4 — 48h reservation-release button", () => {
  it("renders the release sweep button", () => {
    renderWithIntl(<ReleaseStaleReservationsButton />);
    expect(
      screen.getByRole("button", { name: /Libérer les réservations échues/ }),
    ).toBeInTheDocument();
  });
});
