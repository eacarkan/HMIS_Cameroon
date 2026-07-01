import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (i > g). Phase 4G — patient matching (local, warning-only, no merge).
test.describe("Phase 4G — patient-match review", () => {
  test("admin sees the warning-only queue with the no-merge + mock-MPI notices and can run detection", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/patients/match-review");
    await expect(page.getByRole("heading", { name: "Rapprochement de patients (préparation)" })).toBeVisible();
    await expect(page.getByText("Avertissement uniquement — AUCUNE fusion", { exact: false })).toBeVisible();
    await expect(page.getByText("MPI FICTIF", { exact: false })).toBeVisible();

    // Run local detection (0+ candidates on the reset demo DB) — the action reports a warning-only result.
    await page.getByRole("button", { name: "Générer les candidats" }).click();
    await expect(page.getByText(/candidat\(s\) créé\(s\)/)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase4g-screenshots/01-match-review.png", fullPage: true });
  });

  test("a clinical doctor cannot reach the patient-match screen (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await page.goto("/patients/match-review");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rapprochement de patients (préparation)" })).toHaveCount(0);
  });
});
