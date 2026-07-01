import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4C — external result import (staging + review; never
// auto-clinical). The admin imports to staging; a DIFFERENT reviewer works the queue (separate tests
// because the login helper uses a fresh context per test; the staged row persists in the e2e DB).
test.describe.serial("Phase 4C — external result import", () => {
  test("admin imports a result to staging (warning shown)", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/laboratoire/import");
    await expect(page.getByRole("heading", { name: "Import de résultats externes (labo / radio)" })).toBeVisible();
    await expect(page.getByText(/Non clinique tant que non révisé/)).toBeVisible();

    const csv = "externalRef,patientRef,orderRef,modality,testCode,resultText\nE2E-C-1,UNKNOWN-P,,lab,NFS,RAS";
    await page.locator('textarea[name="csv"]').fill(csv);
    await page.getByRole("button", { name: "Importer" }).click();
    await expect(page.getByText("NFS (lab)")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("À réviser")).toBeVisible();
    await page.screenshot({ path: "docs/phase4c-screenshots/01-import-queue.png", fullPage: true });
  });

  test("a reviewer (diagnostics technician, ≠ importer) sees the queue and rejects the import", async ({ page }) => {
    await login(page, ACCOUNTS.labTech);
    await page.goto("/laboratoire/import");
    await expect(page.getByText("NFS (lab)")).toBeVisible({ timeout: 15_000 });
    const reviewForm = page.locator("form").filter({ hasText: "Motif" }).first();
    await reviewForm.getByRole("button", { name: "Rejeter" }).click();
    await expect(page.getByText("Rejeté").first()).toBeVisible({ timeout: 15_000 });
  });

  test("a clinical doctor cannot reach the import screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/laboratoire/import");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Import de résultats externes (labo / radio)" })).toHaveCount(0);
  });
});
