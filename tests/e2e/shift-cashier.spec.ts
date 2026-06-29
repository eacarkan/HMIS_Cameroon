import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch3-screenshots";

/**
 * Phase 1A Batch 3 — cashier day cycle (E2E): issue → pay → report (totals by mode) →
 * close shift → void (with reason) → voided receipt marking. Self-contained (its own
 * fictional patient), sorts AFTER golden-path. Runs against the TEST database.
 */
test.describe.serial("cashier controls", () => {
  test("issue → pay → report → close shift → void → voided receipt", async ({ page }) => {
    // Reception registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("MENGUE");
    await page.locator('input[name="givenName"]').fill("Caisse Test");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1980-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Facturation test");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Cashier issues the invoice and records payment.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Créer la facture" }).click();
    await page.waitForURL(/\/facturation$/);
    await page.locator('input[name="qty_consultation_generale"]').fill("1");
    await page.getByRole("button", { name: "Créer la facture" }).click();
    await page.waitForURL(/\/factures\/[^/]+$/);
    const invoiceUrl = page.url();
    await page.getByRole("button", { name: "Encaisser" }).click();
    await expect(page.getByText("Payée").first()).toBeVisible();

    // Cashier report — totals by payment mode.
    await page.goto("/rapports-caisse");
    await expect(page.getByText("Totaux par mode de paiement")).toBeVisible();
    await expect(page.getByText("HRB-DEMO-R-2026-000002").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-report-by-method.png`, fullPage: true });

    // Close the shift (audited totals by mode).
    await page.getByRole("button", { name: "Clôturer la caisse" }).click();
    await expect(page.getByText(/Caisse clôturée/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-shift-closed.png`, fullPage: true });

    // Void the invoice with a reason.
    await page.goto(invoiceUrl);
    await page.getByLabel("Motif d'annulation").fill("Erreur de facturation (test)");
    await page.getByRole("button", { name: "Annuler la facture" }).click();
    await expect(page.getByText(/Facture annulée/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-voided-invoice.png`, fullPage: true });
    // (The voided-receipt "Reçu annulé" marking is covered by the component test, and the
    // payment→cancelled state by the integration suite.)
  });
});
