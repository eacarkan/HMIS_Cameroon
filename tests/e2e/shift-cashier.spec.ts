import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2c-screenshots";

/**
 * Phase 2C — cashier day cycle (E2E): open Brouillard → issue → pay → daily report → close
 * Brouillard (five frozen fields + Chief Cashier signature) → request cancellation (cashier) →
 * approve (admin) → refund voucher. Self-contained (its own fictional patient); sorts AFTER the
 * golden path. Runs against the TEST database.
 */
test.describe.serial("cashier controls (Phase 2C)", () => {
  test("open shift → pay → close Brouillard → request cancel → admin approve → refund", async ({
    page,
  }) => {
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

    // Cashier opens a Brouillard (opening balance), then issues + pays within the shift window.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto("/caisse/brouillard");
    await page.locator('input[name="openingBalance"]').fill("5000");
    await page.getByRole("button", { name: "Ouvrir la caisse" }).click();
    await expect(page.getByText("Caisse ouverte")).toBeVisible();

    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Créer la facture" }).click();
    await page.waitForURL(/\/facturation$/);
    await page.locator('input[name="qty_consultation_generale"]').fill("1");
    await page.getByRole("button", { name: "Créer la facture" }).click();
    await page.waitForURL(/\/factures\/[^/]+$/);
    const invoiceUrl = page.url();
    await page.getByRole("button", { name: "Encaisser" }).click();
    await expect(page.getByText("Payée").first()).toBeVisible();

    // Cashier daily report — totals by payment mode.
    await page.goto("/rapports-caisse");
    await expect(page.getByText("Totaux par mode de paiement")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-report-by-method.png`, fullPage: true });

    // Close the Brouillard, then open the printable view (five mandatory fields + signature).
    await page.goto("/caisse/brouillard");
    await page.getByRole("button", { name: "Clôturer la caisse" }).click();
    await page.getByRole("link", { name: /HRB-DEMO-B-/ }).first().click();
    await expect(page.getByText("Solde de clôture théorique")).toBeVisible();
    await expect(page.getByText("Signature du chef de caisse")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-brouillard.png`, fullPage: true });

    // Cashier requests an invoice cancellation (mandatory reason) — does NOT cancel yet.
    await page.goto(invoiceUrl);
    await page.getByLabel(/Motif de la demande d'annulation/).fill("Erreur de facturation (test)");
    await page.getByRole("button", { name: "Demander l'annulation" }).click();
    await expect(page.getByText(/en attente d'approbation/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-cancellation-request.png`, fullPage: true });

    // Admin approves the cancellation → invoice cancelled + refund voucher raised.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.admin);
    await page.goto("/annulations");
    await expect(page.getByText("Erreur de facturation (test)")).toBeVisible();
    await page.getByRole("button", { name: "Approuver" }).first().click();
    // Wait for the approval to COMMIT before navigating away: the server action revalidates
    // /annulations in place, replacing the decide-forms with the linked refund-voucher number.
    // A bare page.goto() here can abort the still-in-flight server action (the voucher would never
    // be written) — slower under the grown app, which is why this raced only as routes multiplied.
    await expect(page.getByText(/HRB-DEMO-A-2026-/).first()).toBeVisible();
    await page.goto("/remboursements");
    await expect(page.getByText("HRB-DEMO-A-2026-000001")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-refund-voucher.png`, fullPage: true });
  });
});
