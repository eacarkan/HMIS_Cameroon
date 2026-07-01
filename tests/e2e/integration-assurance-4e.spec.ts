import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4E — insurance / mutuelle foundation (manual only).
test.describe("Phase 4E — insurance / mutuelle foundation", () => {
  test("admin registers a payer + coverage profile (manual, hospital-scoped)", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/facturation/assurance");
    await expect(page.getByRole("heading", { name: "Assurance / Mutuelle (préparation)" })).toBeVisible();
    await expect(page.getByText("Manuel uniquement — aucune API assureur", { exact: false })).toBeVisible();

    // Register a payer.
    const payerForm = page.locator("form").filter({ hasText: "Type" });
    await payerForm.locator('input[name="code"]').fill("E2E_CNPS");
    await payerForm.locator('input[name="name"]').fill("CNPS démo");
    await payerForm.getByRole("button", { name: "Créer un payeur" }).click();
    // The label appears in both the payer card and the coverage-link <option>; the card renders first.
    await expect(page.getByText("E2E_CNPS — CNPS démo", { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // Add a coverage profile to that payer.
    const profileForm = page.locator("form").filter({ hasText: "Code profil" }).first();
    await profileForm.locator('input[name="code"]').fill("STD");
    await profileForm.locator('input[name="name"]').fill("Standard");
    await profileForm.getByRole("button", { name: "Ajouter un profil" }).click();
    await expect(page.getByText("STD 80%", { exact: false })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4e-screenshots/01-assurance.png", fullPage: true });
  });

  test("a clinical doctor cannot reach the insurance screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/facturation/assurance");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assurance / Mutuelle (préparation)" })).toHaveCount(0);
  });
});
