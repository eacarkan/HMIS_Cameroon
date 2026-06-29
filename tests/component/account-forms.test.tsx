import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ChangePasswordForm,
  ResetPasswordForm,
} from "@/components/account/change-password-form";
import { renderWithIntl } from "../helpers/render";

vi.mock("@/server/actions/account-actions", () => ({
  changePasswordAction: vi.fn(),
  resetUserPasswordAction: vi.fn(),
}));

describe("Phase 1A Batch 4 — account forms", () => {
  it("change-password form has current/new/confirm fields and the policy hint", () => {
    renderWithIntl(<ChangePasswordForm />);
    expect(screen.getByLabelText("Mot de passe actuel")).toBeInTheDocument();
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmer le nouveau mot de passe")).toBeInTheDocument();
    expect(screen.getByText(/Au moins 8 caractères/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Changer le mot de passe" })).toBeInTheDocument();
  });

  it("admin reset form renders a password field and reset action", () => {
    renderWithIntl(<ResetPasswordForm userId="u1" />);
    expect(screen.getByLabelText("Réinitialiser le mot de passe")).toBeRequired();
    expect(screen.getByRole("button", { name: "Réinitialiser" })).toBeInTheDocument();
  });
});
