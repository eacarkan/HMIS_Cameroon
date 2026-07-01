import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4D — payment provider abstraction (mock only).
test.describe("Phase 4D — external payment provider", () => {
  test("cashier creates a mock provider + intent and confirms it (no invoice movement)", async ({ page }) => {
    await login(page, ACCOUNTS.cashier);
    await page.goto("/facturation/paiements-externes");
    await expect(page.getByRole("heading", { name: "Paiements externes (Mobile Money — préparation)" })).toBeVisible();
    await expect(page.getByText("Prestataire FICTIF — aucun paiement réel")).toBeVisible();

    // Create a mock provider.
    const providerForm = page.locator("form").filter({ hasText: "Canal" });
    await providerForm.locator('input[name="code"]').fill("E2E_MOMO");
    await providerForm.locator('input[name="name"]').fill("Mobile Money démo");
    await providerForm.getByRole("button", { name: "Créer un prestataire" }).click();
    await expect(page.getByText("E2E_MOMO — Mobile Money démo")).toBeVisible({ timeout: 15_000 });

    // Create an intent (no invoice) and confirm it.
    const intentForm = page.locator("form").filter({ hasText: "Référence" });
    await intentForm.locator('input[name="externalReference"]').fill("E2E-PAY-1");
    await intentForm.locator('input[name="amount"]').fill("2500");
    await intentForm.getByRole("button", { name: "Créer une intention" }).click();
    await expect(page.getByText("En attente")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Confirmer (fictif)" }).click();
    await expect(page.getByText("Confirmée").first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4d-screenshots/01-payments.png", fullPage: true });
  });

  test("a clinical doctor cannot reach the external-payments screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/facturation/paiements-externes");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paiements externes (Mobile Money — préparation)" })).toHaveCount(0);
  });
});
