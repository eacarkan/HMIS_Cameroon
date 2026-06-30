import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-8 — read-only pharmacy report (E2E). The pharmacist opens the report and sees the stock
 * levels, low-stock, expiry and dispensing-volume sections. Reception is redirected (RBAC). Sorts
 * after the other pharmacy specs so dispensing data has accumulated.
 */
test.describe("Phase 2D-8 — pharmacy report", () => {
  test("pharmacist sees the read-only pharmacy report", async ({ page }) => {
    await login(page, ACCOUNTS.pharmacist);
    await page.goto("/pharmacie/rapports");
    await expect(page.getByRole("heading", { name: "Rapports pharmacie" }).first()).toBeVisible();
    await expect(page.getByText("Médicaments suivis")).toBeVisible();
    await expect(page.getByText("Niveaux de stock par médicament")).toBeVisible();
    // The seeded Paracétamol stock line is present in the levels table.
    await expect(page.getByRole("cell", { name: /Paracétamol/ }).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/07-pharmacy-report.png`, fullPage: true });
  });

  test("reception cannot reach the pharmacy report (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/pharmacie/rapports");
    await expect(page).not.toHaveURL(/\/pharmacie\/rapports$/);
  });
});
