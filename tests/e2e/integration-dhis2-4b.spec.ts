import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4B — DHIS2 configurable export (aggregate-only; mock API).
test.describe("Phase 4B — DHIS2 export framework", () => {
  test("admin creates a mapping set, adds a mapping, and runs a mock API export", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration/dhis2");
    await expect(page.getByRole("heading", { name: "Export DHIS2 (préparation)" })).toBeVisible();
    await expect(page.getByText("Agrégat uniquement — aucune donnée patient")).toBeVisible();

    // Create a mapping set.
    const createForm = page.locator("form").filter({ hasText: "Org-unit (placeholder)" });
    await createForm.locator('input[name="code"]').fill("E2E_DHIS2");
    await createForm.locator('input[name="name"]').fill("DHIS2 démo");
    await createForm.getByRole("button", { name: "Créer un jeu de correspondances" }).click();
    await expect(page.getByText("E2E_DHIS2 — DHIS2 démo")).toBeVisible({ timeout: 15_000 });

    // Add a wildcard + consultations mapping so the export is ready.
    const consForm = page.locator("form").filter({ hasText: "Élément local" });
    await consForm.locator('input[name="localElement"]').fill("CONSULTATIONS");
    await consForm.locator('input[name="dataElementPlaceholder"]').fill("DE_CONS");
    await consForm.getByRole("button", { name: "Ajouter une correspondance" }).click();
    await expect(page.getByText("CONSULTATIONS → DE_CONS")).toBeVisible({ timeout: 15_000 });

    // Run the mock API export (no network).
    await page.getByRole("button", { name: "Export API fictif" }).click();
    await expect(page.getByText(/Export API fictif/)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4b-screenshots/01-dhis2-export.png", fullPage: true });
  });

  test("a clinical role cannot reach the DHIS2 screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/administration/dhis2");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Export DHIS2 (préparation)" })).toHaveCount(0);
  });
});
