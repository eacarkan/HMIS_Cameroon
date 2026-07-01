import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-1 — medication catalogue (E2E). Admin manages the catalogue; a non-admin (reception)
 * is redirected away (capability-based RBAC). Self-contained; sorts after the golden path.
 */
test.describe("Phase 2D-1 — medication catalogue", () => {
  test("admin adds a medication; the seeded catalogue is visible", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration/medicaments");
    await expect(page.getByRole("heading", { name: "Catalogue des médicaments" }).first()).toBeVisible();
    // Seeded synthetic medication is listed.
    await expect(page.getByText("Paracétamol").first()).toBeVisible();

    // Add a new medication.
    await page.locator('input[name="code"]').fill("MED-E2E-1");
    await page.locator('input[name="nameFr"]').fill("Médicament E2E");
    await page.locator('input[name="nameEn"]').fill("E2E Medication");
    await page.locator('select[name="form"]').selectOption("Comprimé");
    await page.locator('input[name="unit"]').fill("comprimé");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("MED-E2E-1")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-medication-catalogue.png`, fullPage: true });
  });

  test("reception cannot reach the medication catalogue (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/administration/medicaments");
    // Redirected away from the admin-only catalogue.
    await expect(page).not.toHaveURL(/\/administration\/medicaments$/);
  });
});
