import { test, expect } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

/**
 * Phase 6.6 — finance workspace end-to-end (deposit reconciliation + numbered revenue statement) and the
 * RBAC boundary. The cashier (a finance role) can open the workspace, create a deposit slip and generate a
 * numbered statement; a clinician (no finance capability) is redirected away from the finance routes.
 * Synthetic review environment; runs against the test database.
 */
test("cashier opens the finance workspace and creates a deposit slip", async ({ page }) => {
  await login(page, ACCOUNTS.cashier);

  await page.goto("/facturation");
  await expect(page.getByRole("heading", { name: "Espace financier" })).toBeVisible();

  await page.goto("/facturation/rapprochement");
  await expect(page.getByRole("heading", { name: "Rapprochement bancaire" })).toBeVisible();

  await page.getByLabel("Total déclaré (FCFA)").fill("5000");
  await page.getByRole("button", { name: "Créer le bordereau" }).click();

  // The new bordereau (HRB-DEMO-BV-YYYY-NNNNNN) appears in the slips table.
  await expect(page.getByText(/HRB-DEMO-BV-\d{4}-\d{6}/)).toBeVisible({ timeout: 15_000 });
});

test("cashier generates a numbered monthly revenue statement", async ({ page }) => {
  await login(page, ACCOUNTS.cashier);

  await page.goto("/facturation/etat-recettes");
  await expect(page.getByRole("heading", { name: /État mensuel numéroté des recettes/ })).toBeVisible();

  await page.getByRole("button", { name: /Générer l.état numéroté/ }).click();
  await expect(page.getByText(/HRB-DEMO-ETAT-\d{4}-\d{6}/)).toBeVisible({ timeout: 15_000 });
});

test("cashier opens the Mobile Money report and receivables aging", async ({ page }) => {
  await login(page, ACCOUNTS.cashier);

  await page.goto("/facturation/mobile-money");
  await expect(page.getByRole("heading", { name: /Mobile Money/ })).toBeVisible();

  await page.goto("/facturation/creances");
  await expect(page.getByRole("heading", { name: /Créances/ })).toBeVisible();
});

test("a clinician without finance capability is redirected away from reconciliation", async ({ page }) => {
  await login(page, ACCOUNTS.doctor);

  await page.goto("/facturation/rapprochement");
  // Redirected to the dashboard; the reconciliation screen never renders.
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rapprochement bancaire" })).toHaveCount(0);
});
