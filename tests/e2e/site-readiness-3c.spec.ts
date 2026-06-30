import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (s > g). Phase 3C — site-readiness checklist (status tracking only).
test.describe("Phase 3C — site readiness checklist", () => {
  test("admin views the checklist and updates a readiness item", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration/preparation-site");
    await expect(page.getByRole("heading", { name: "Préparation du site (déploiement)" })).toBeVisible();
    await expect(page.getByText("Liste de contrôle", { exact: true })).toBeVisible();
    // A known category + its supplier-dependent marker (hardware).
    await expect(page.getByText("Matériel (postes, serveur)")).toBeVisible();
    await page.screenshot({ path: "docs/phase3c-screenshots/01-checklist.png", fullPage: true });

    // Update the "training" (Formation du personnel) item to Ready (non-supplier, so allowed).
    const trainingForm = page.locator("form").filter({ hasText: "Formation du personnel" });
    await trainingForm.locator('select[name="status"]').selectOption("ready");
    await trainingForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(trainingForm.getByText("Enregistré.")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase3c-screenshots/02-item-updated.png", fullPage: true });
  });

  test("a non-oversight role cannot reach the readiness checklist (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/administration/preparation-site");
    // readiness.view denied → redirected to the dashboard.
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Préparation du site (déploiement)" }),
    ).toHaveCount(0);
  });
});
