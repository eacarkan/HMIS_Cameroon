import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (u > g). Phase 3E — UAT evidence + Gate 7 readiness (evidence only).
test.describe("Phase 3E — UAT + Gate 7 readiness", () => {
  test("admin sees the non-authorization disclaimer and records a UAT execution", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/uat");
    await expect(page.getByRole("heading", { name: "Recette (UAT) + préparation Gate 7" })).toBeVisible();
    // The mandatory "evidence only — not an authorization" disclaimer is shown.
    await expect(page.getByText(/ne constitue pas une autorisation/)).toBeVisible();
    await expect(page.getByText("Scénarios UAT")).toBeVisible();
    await page.screenshot({ path: "docs/phase3e-screenshots/01-uat-readiness.png", fullPage: true });

    // Record the patient-registration UAT scenario (UAT-REG) as passed.
    const row = page.locator("li").filter({ hasText: "UAT-REG" });
    await row.locator('select[name="status"]').selectOption("pass");
    await row.getByRole("button", { name: "Enregistrer" }).click();
    await expect(row.getByText("Enregistré.")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/phase3e-screenshots/02-uat-recorded.png", fullPage: true });
  });

  test("a non-UAT role cannot reach the UAT/Gate 7 page (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.cashier);
    await page.goto("/uat");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recette (UAT) + préparation Gate 7" })).toHaveCount(0);
  });
});
