import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateIntentForm, CreateProviderForm, TxnActions } from "@/components/admin/external-payment-admin";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/external-payment-actions", () => ({
  createProviderAction: vi.fn(),
  createIntentAction: vi.fn(),
  paymentActionByDecision: vi.fn(),
}));

describe("Phase 4D — external payment forms", () => {
  it("the provider form renders code/name/channel", () => {
    renderWithIntl(<CreateProviderForm />);
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Canal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer un prestataire" })).toBeInTheDocument();
  });

  it("the intent form renders reference/amount/invoice", () => {
    renderWithIntl(<CreateIntentForm providerId="p-1" />);
    expect(screen.getByText("Référence")).toBeInTheDocument();
    expect(screen.getByText("Montant (FCFA)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer une intention" })).toBeInTheDocument();
  });

  it("a PENDING transaction offers confirm; a CONFIRMED-unreconciled offers reconcile", () => {
    const { unmount } = renderWithIntl(<TxnActions id="t-1" status="PENDING" reconciled={false} />);
    expect(screen.getByRole("button", { name: "Confirmer (fictif)" })).toBeInTheDocument();
    unmount();
    renderWithIntl(<TxnActions id="t-2" status="CONFIRMED" reconciled={false} />);
    expect(screen.getByRole("button", { name: "Rapprocher" })).toBeInTheDocument();
  });
});
