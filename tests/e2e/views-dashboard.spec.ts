import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch5-screenshots";

/**
 * Phase 1A Batch 5 — role-specific dashboards (E2E). The cashier dashboard shows the
 * billing/cashier section; the reception dashboard does not. Read-only, hospital-scoped.
 * Sorts last (no data creation). Runs against the TEST database.
 */
test.describe.serial("role dashboards", () => {
  test("cashier sees billing section; reception does not", async ({ page }) => {
    await login(page, ACCOUNTS.cashier);
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText("Activité du jour")).toBeVisible();
    await expect(page.getByText("Facturation & caisse")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-cashier-dashboard.png`, fullPage: true });

    await page.context().clearCookies();
    await login(page, ACCOUNTS.reception);
    await expect(page.getByText("Activité du jour")).toBeVisible();
    await expect(page.getByText("Facturation & caisse")).toHaveCount(0);
    await expect(page.getByText("Activité clinique")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/02-reception-dashboard.png`, fullPage: true });
  });
});
