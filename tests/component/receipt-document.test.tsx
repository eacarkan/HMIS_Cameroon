import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ReceiptDocument,
  type ReceiptData,
} from "@/components/print/receipt-document";
import { PROTOTYPE_LABEL } from "@/lib/constants";
import { renderWithIntl } from "../helpers/render";

const data: ReceiptData = {
  paymentId: "p1",
  receiptNumber: "HRB-DEMO-R-2026-000001",
  invoiceNumber: "HRB-DEMO-F-2026-000001",
  patientName: "Aïssatou BELLO",
  patientNumber: "HRB-DEMO-P-2026-000001",
  hospitalName: "Hôpital Régional de Bertoua — Démo",
  items: [
    { label: "Consultation médecine générale", quantity: 1, lineTotal: 2000 },
    { label: "Frais d'ouverture de dossier", quantity: 1, lineTotal: 1000 },
  ],
  total: 3000,
  amount: 3000,
  methodLabel: "Espèces",
  cashierName: "Solange ABENA",
  dateLabel: "27/06/2026 09:40",
};

describe("ReceiptDocument (06 §13)", () => {
  it("renders the official header, identifiers, lines, total and prototype label", () => {
    renderWithIntl(<ReceiptDocument data={data} />);

    expect(screen.getByText("République du Cameroun")).toBeInTheDocument();
    expect(
      screen.getByText("Ministère de la Santé Publique"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hôpital Régional de Bertoua — Démo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Reçu de paiement/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/HRB-DEMO-R-2026-000001/)).toBeInTheDocument();
    expect(screen.getByText("Aïssatou BELLO")).toBeInTheDocument();
    expect(screen.getByText("HRB-DEMO-P-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("HRB-DEMO-F-2026-000001")).toBeInTheDocument();

    expect(
      screen.getByText("Consultation médecine générale"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Frais d'ouverture de dossier"),
    ).toBeInTheDocument();

    expect(screen.getByText("Montant payé")).toBeInTheDocument();
    expect(screen.getByText("Caissier")).toBeInTheDocument();
    expect(screen.getByText("Solange ABENA")).toBeInTheDocument();
    // Total + Montant payé both show 3 000 FCFA (RTL normalizes the narrow spaces).
    expect(screen.getAllByText("3 000 FCFA").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(PROTOTYPE_LABEL)).toBeInTheDocument();
  });
});
