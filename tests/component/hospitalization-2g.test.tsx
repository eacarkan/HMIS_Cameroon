import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdmissionControls, type AdmissionView } from "@/components/hospitalization/admission-controls";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/hospitalization-actions", () => ({
  requestAdmissionAction: vi.fn(),
  assignWardAction: vi.fn(),
  generateDailyChargeAction: vi.fn(),
  requestDischargeAction: vi.fn(),
  authorizeDischargeAction: vi.fn(),
  cancelAdmissionAction: vi.fn(),
}));

const allCaps = { request: true, assign: true, discharge: true, fee: true };
const wards = [{ id: "w1", name: "Médecine interne (hospitalisation)" }];
const noBlock = { blocked: false, reasons: [] as string[] };

const admitted: AdmissionView = {
  id: "a1",
  admissionNumber: "HRB-DEMO-H-2026-000001",
  status: "admitted",
  reason: "Surveillance",
  wardName: "Médecine interne (hospitalisation)",
  dailyWardFeeLabel: "10 000 FCFA",
  invoiceId: "inv1",
  invoiceNumber: "HRB-DEMO-F-2026-000005",
  invoiceTotalLabel: "20 000 FCFA",
  dailyChargeCount: 2,
  cancelReason: null,
};

describe("Phase 2G — admission controls", () => {
  it("with no admission, a doctor sees the request form", () => {
    renderWithIntl(
      <AdmissionControls encounterId="e1" admission={null} wards={wards} dischargeBlock={noBlock} caps={allCaps} />,
    );
    expect(screen.getByRole("button", { name: "Demander l'hospitalisation" })).toBeInTheDocument();
  });

  it("with no admission and no request cap, shows the empty notice (no form)", () => {
    renderWithIntl(
      <AdmissionControls
        encounterId="e1"
        admission={null}
        wards={wards}
        dischargeBlock={noBlock}
        caps={{ request: false, assign: false, discharge: true, fee: true }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Demander l'hospitalisation" })).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune hospitalisation/)).toBeInTheDocument();
  });

  it("a requested admission offers ward assignment to the admission desk", () => {
    const requested: AdmissionView = { ...admitted, status: "requested", wardName: null, dailyWardFeeLabel: null, invoiceNumber: null, invoiceId: null, invoiceTotalLabel: null, dailyChargeCount: 0 };
    renderWithIntl(
      <AdmissionControls encounterId="e1" admission={requested} wards={wards} dischargeBlock={noBlock} caps={allCaps} />,
    );
    expect(screen.getByRole("button", { name: "Attribuer le service" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Demander la sortie" })).not.toBeInTheDocument();
  });

  it("an admitted admission shows the ward, daily fee, invoice link, and discharge/charge actions", () => {
    renderWithIntl(
      <AdmissionControls encounterId="e1" admission={admitted} wards={wards} dischargeBlock={noBlock} caps={allCaps} />,
    );
    expect(screen.getByText("HRB-DEMO-H-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("10 000 FCFA")).toBeInTheDocument();
    expect(screen.getByText("HRB-DEMO-F-2026-000005")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Générer les frais du jour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Autoriser la sortie" })).toBeInTheDocument();
  });

  it("a blocked discharge disables Authorize and shows the reasons", () => {
    renderWithIntl(
      <AdmissionControls
        encounterId="e1"
        admission={admitted}
        wards={wards}
        dischargeBlock={{ blocked: true, reasons: ["1 facture non réglée"] }}
        caps={allCaps}
      />,
    );
    expect(screen.getByRole("button", { name: "Autoriser la sortie" })).toBeDisabled();
    expect(screen.getByText(/1 facture non réglée/)).toBeInTheDocument();
  });

  it("without the fee/discharge caps, the admitted view shows no charge/discharge controls", () => {
    renderWithIntl(
      <AdmissionControls
        encounterId="e1"
        admission={admitted}
        wards={wards}
        dischargeBlock={noBlock}
        caps={{ request: false, assign: false, discharge: false, fee: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Générer les frais du jour" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Autoriser la sortie" })).not.toBeInTheDocument();
  });
});
