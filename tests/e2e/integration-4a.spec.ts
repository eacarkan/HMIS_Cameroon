import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4A — integration framework (mock/sandbox-first; no
// live calls). Admin configures a mock external system + connector, runs a mock job, observes status.
test.describe("Phase 4A — integration framework", () => {
  test("admin registers a mock system, runs a mock job, and sees it succeed", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/administration/integration");
    await expect(page.getByRole("heading", { name: "Intégrations (cadre)" })).toBeVisible();
    // The MOCK / no-live-call notice is prominent.
    await expect(page.getByText("MOCK / sandbox uniquement")).toBeVisible();
    await page.screenshot({ path: "docs/phase4a-screenshots/01-integration.png", fullPage: true });

    // Register an external system (mock).
    const createForm = page.locator("form").filter({ hasText: "Code" }).first();
    await createForm.locator('input[name="code"]').fill("E2E_DHIS2");
    await createForm.locator('input[name="name"]').fill("DHIS2 démo");
    await createForm.locator('input[name="kind"]').fill("GENERIC");
    await createForm.getByRole("button", { name: "Créer un système externe" }).click();
    await expect(page.getByText("E2E_DHIS2 — DHIS2 démo")).toBeVisible({ timeout: 15_000 });

    // Configure a MOCK connector on that system (only one system → one connector form).
    const connectorForm = page.locator("form").filter({ hasText: "Nom du connecteur" });
    await connectorForm.locator('input[name="name"]').fill("mock-primary");
    await connectorForm.locator('select[name="environment"]').selectOption("MOCK");
    await connectorForm.getByRole("button", { name: "Enregistrer le connecteur" }).click();
    await expect(page.getByText("mock-primary").first()).toBeVisible({ timeout: 15_000 });

    // Run a mock job and observe SUCCEEDED in the jobs list.
    const runForm = page.locator("form").filter({ hasText: "Type de tâche" });
    await runForm.locator('input[name="ref"]').fill("e2e-run-1");
    await runForm.getByRole("button", { name: "Exécuter (fictif)" }).click();
    await expect(page.getByText("Réussi").first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4a-screenshots/02-job-succeeded.png", fullPage: true });
  });

  test("a clinical role cannot reach the integration screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/administration/integration");
    // integration.job.view denied → redirected to the dashboard.
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Intégrations (cadre)" })).toHaveCount(0);
  });
});
