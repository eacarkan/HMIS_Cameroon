import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-7 — stock adjustment dual validation (E2E). A pharmacist requests a loss adjustment; the
 * Pharmacist-in-Charge approves it. Self-contained; sorts after the golden path. Uses a small quantity
 * so later pharmacy specs keep enough Paracétamol stock.
 */
test.describe.serial("Phase 2D-7 — stock adjustment dual validation", () => {
  test("pharmacist requests an adjustment; the Pharmacist-in-Charge approves it", async ({ page }) => {
    // Pharmacist requests a loss adjustment from the stock page.
    await login(page, ACCOUNTS.pharmacist);
    await page.goto("/pharmacie/stock");
    // The card title is a shadcn CardTitle (a div, not a semantic heading).
    await expect(page.getByText("Demander un ajustement")).toBeVisible();
    await page.getByLabel("Type").selectOption({ label: "Perte / avarie" });
    await page.locator("#adj-qty").fill("5");
    await page.locator("#adj-reason").fill("Casse au comptoir (démo)");
    await page.getByRole("button", { name: "Demander l'ajustement" }).click();
    await expect(page.getByText(/Demande enregistrée/)).toBeVisible();

    // The request shows on the adjustments worklist, pending.
    await page.goto("/pharmacie/ajustements");
    await expect(page.getByText("Casse au comptoir (démo)")).toBeVisible();
    await expect(page.getByText("En attente").first()).toBeVisible();

    // The Pharmacist-in-Charge approves it.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.pharmacistChief);
    await page.goto("/pharmacie/ajustements");
    await expect(page.getByText("Casse au comptoir (démo)")).toBeVisible();
    await page.getByRole("button", { name: "Approuver" }).first().click();
    await expect(page.getByText("Approuvé").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/06-stock-adjustment.png`, fullPage: true });
  });

  test("reception cannot reach the stock-adjustment worklist (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/pharmacie/ajustements");
    await expect(page).not.toHaveURL(/\/pharmacie\/ajustements$/);
  });
});
