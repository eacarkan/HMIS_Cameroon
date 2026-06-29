import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (so the seeded golden-path patient/encounter already exist).
test.describe("Phase 2A — service catalogue", () => {
  test("admin manages the Bertoua catalogue; the language toggle switches Fr/En", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();

    // The catalogue section + a seeded Bertoua service.
    await expect(page.getByText("Catalogue des services")).toBeVisible();
    await expect(page.getByText("Médecine générale").first()).toBeVisible();
    await page.screenshot({ path: "docs/phase2a-screenshots/01-catalogue-fr.png", fullPage: true });

    // Create a uniquely-named service via the catalogue create form (scoped by aria-label).
    const createForm = page.locator('form[aria-label="Ajouter un service"]');
    await createForm.locator('input[name="code"]').fill("SRV-E2E-1");
    await createForm.locator('input[name="nameFr"]').fill("Service E2E");
    await createForm.getByRole("button", { name: "Ajouter un service" }).click();
    await expect(page.getByText("(SRV-E2E-1)")).toBeVisible();
    await page.screenshot({ path: "docs/phase2a-screenshots/02-after-create.png", fullPage: true });

    // Language toggle → English label appears, then back to French.
    // (exact:true — "EN"/"FR" must not substring-match buttons like "Descendre".)
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText("Service catalogue")).toBeVisible();
    await page.screenshot({ path: "docs/phase2a-screenshots/03-catalogue-en.png", fullPage: true });
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page.getByText("Catalogue des services")).toBeVisible();
  });

  test("reception cannot reach administration (capability-based RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/administration");
    // config.read is denied → redirected to the dashboard.
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Administration" })).toHaveCount(0);
  });
});
