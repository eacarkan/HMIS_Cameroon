import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4F — analytics foundation (aggregate-only).
test.describe("Phase 4F — advanced reporting / analytics foundation", () => {
  test("admin defines a report, runs it, and exports the aggregate output (registry)", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration/analytics");
    await expect(page.getByRole("heading", { name: "Analytique (préparation)" })).toBeVisible();
    await expect(page.getByText("Agrégats uniquement — aucune donnée patient", { exact: false })).toBeVisible();

    // Define a report.
    const defForm = page.locator("form").filter({ hasText: "Type de rapport" });
    await defForm.locator('input[name="code"]').fill("E2E_MENSUEL");
    await defForm.locator('input[name="name"]').fill("Synthèse démo");
    await defForm.getByRole("button", { name: "Créer une définition" }).click();
    await expect(page.getByText("E2E_MENSUEL — Synthèse démo", { exact: false })).toBeVisible({ timeout: 15_000 });

    // Run it (on-demand, current period default).
    const runForm = page.locator("form").filter({ hasText: "Déclencheur" });
    await runForm.getByRole("button", { name: "Exécuter" }).click();
    await expect(page.getByText("Terminée").first()).toBeVisible({ timeout: 15_000 });

    // Export the completed run to the registry — the action confirms the recorded export.
    await page.getByRole("button", { name: "Exporter CSV" }).first().click();
    await expect(page.getByText(/Export CSV enregistré/)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4f-screenshots/01-analytics.png", fullPage: true });
  });

  test("a clinical doctor cannot reach the analytics screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/administration/analytics");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Analytique (préparation)" })).toHaveCount(0);
  });
});
