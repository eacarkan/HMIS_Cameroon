import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-3 — pharmacy stock (E2E). The pharmacist sees the seeded ledger and receives a new batch.
 * A non-pharmacy, non-oversight role (reception) is redirected. Sorts after the golden path.
 */
test.describe("Phase 2D-3 — pharmacy stock", () => {
  test("pharmacist receives a batch; the seeded ledger is visible", async ({ page }) => {
    await login(page, ACCOUNTS.pharmacist);
    await page.goto("/pharmacie/stock");
    await expect(page.getByRole("heading", { name: "Stock pharmacie" }).first()).toBeVisible();
    // Seeded stock is listed.
    await expect(page.getByText("Paracétamol").first()).toBeVisible();

    // Receive a new batch.
    await page.locator('input[name="batchNumber"]').fill("LOT-E2E-1");
    await page.locator('input[name="expiryDate"]').fill("2028-06-30");
    await page.locator('input[name="quantity"]').fill("123");
    await page.getByRole("button", { name: "Réceptionner" }).click();
    await expect(page.getByText("LOT-E2E-1")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-stock.png`, fullPage: true });
  });

  test("reception cannot reach the pharmacy stock page (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/pharmacie/stock");
    await expect(page).not.toHaveURL(/\/pharmacie\/stock$/);
  });
});
