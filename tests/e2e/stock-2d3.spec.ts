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
    // Seeded stock is listed — assert on the seeded batch number's VISIBLE ledger cell. (A bare
    // getByText would also match the hidden <option> for this lot in the 2D-7 adjustment-request
    // select, and "Paracétamol" matches the hidden receive-form option — so target the table cell.)
    await expect(page.getByRole("cell", { name: "LOT-PARA-B" })).toBeVisible();

    // Receive a new batch.
    await page.locator('input[name="batchNumber"]').fill("LOT-E2E-1");
    await page.locator('input[name="expiryDate"]').fill("2028-06-30");
    // The receive form's quantity (the 2D-7 adjustment form on this page also has name="quantity").
    await page.locator("#st-qty").fill("123");
    await page.getByRole("button", { name: "Réceptionner" }).click();
    // Target the ledger cell — the received lot also appears as a hidden <option> in the 2D-7 select.
    await expect(page.getByRole("cell", { name: "LOT-E2E-1" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-stock.png`, fullPage: true });
  });

  test("reception cannot reach the pharmacy stock page (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/pharmacie/stock");
    await expect(page).not.toHaveURL(/\/pharmacie\/stock$/);
  });
});
