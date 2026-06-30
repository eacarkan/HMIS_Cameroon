import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2h-screenshots";

/**
 * Phase 2H — emergency exception (E2E). Reception flags an encounter as emergency; the cashier accrues
 * an Emergency Debt; the Hospital Director waives it with a reason. Self-contained; sorts after golden.
 */
test.describe.serial("Phase 2H — emergency exception", () => {
  test("flag emergency → cashier accrues debt → Director waives", async ({ page }) => {
    // Reception registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("URGENCE");
    await page.locator('input[name="givenName"]').fill("Demo");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1980-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Détresse respiratoire");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Flag the encounter as an emergency.
    await page.getByRole("button", { name: "Marquer urgence" }).click();
    await expect(page.getByText("URGENCE").first()).toBeVisible();

    // The cashier accrues an emergency debt.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto(encounterUrl);
    await page.locator("#em-amount").fill("3000");
    await page.locator("#em-source").fill("Soins d'urgence (démo)");
    await page.getByRole("button", { name: "Enregistrer la dette" }).click();
    await expect(page.getByText("Soins d'urgence (démo)")).toBeVisible();

    // The Hospital Director waives the debt with a reason.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.director);
    await page.goto(encounterUrl);
    await page.getByPlaceholder("Motif d'annulation").fill("Patient indigent — décision sociale");
    await page.getByRole("button", { name: "Annuler (Directeur)" }).click();
    await expect(page.getByText("Annulée").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-emergency-debt.png`, fullPage: true });
  });
});
