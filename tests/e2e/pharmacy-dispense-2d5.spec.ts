import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-5 — the full doctor → cashier → pharmacy synthetic journey (E2E): reception opens a
 * visit; the doctor prescribes + finalizes + sends; the cashier confirms collection payment; the
 * pharmacist dispenses (stock deducted) and gets a printable dispense record. Sorts after golden.
 */
test.describe.serial("Phase 2D-5 — dispensing journey", () => {
  test("prescribe → confirm payment → dispense → printable record", async ({ page }) => {
    // Reception opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("DELIVRANCE");
    await page.locator('input[name="givenName"]').fill("Test");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1985-05-05");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Paludisme");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Doctor prescribes + finalizes + sends.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Nouvelle ordonnance" }).click();
    await page.waitForURL(/\/ordonnance\/nouvelle$/);
    // Prescribe a SEEDED, STOCKED medication explicitly — never the catalogue-order default. Earlier
    // specs (medication-catalogue-2d1) add a displayOrder=0 medication that becomes medications[0]
    // but has no stock at this point, so relying on the default would reserve nothing.
    await page.getByLabel("Médicament").first().selectOption({ label: "Paracétamol 500 mg" });
    await page.getByLabel("Posologie").first().fill("1 comprimé");
    await page.getByLabel("Durée").first().fill("5 jours");
    await page.getByLabel("Quantité").first().fill("12");
    await page.getByRole("button", { name: "Créer l'ordonnance" }).click();
    await page.waitForURL(/\/ordonnances\/[^/]+$/);
    const prescriptionUrl = page.url();
    await page.getByRole("button", { name: "Finaliser" }).click();
    await expect(page.getByText("Finalisée").first()).toBeVisible();
    await page.getByRole("button", { name: "Envoyer à la pharmacie" }).click();
    await expect(page.getByText("Envoyée à la pharmacie").first()).toBeVisible();

    // Cashier confirms collection payment.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto(prescriptionUrl);
    await page.getByRole("button", { name: "Confirmer le paiement" }).click();
    await expect(page.getByText("Payée").first()).toBeVisible();

    // Pharmacist dispenses from the worklist.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.pharmacist);
    await page.goto("/pharmacie/dispensation");
    await expect(page.getByText(/HRB-DEMO-O-2026-/).first()).toBeVisible();
    await page.getByRole("button", { name: "Délivrer" }).first().click();
    await page.waitForURL(/\/dispensations\/[^/]+$/);
    await expect(page.getByText(/HRB-DEMO-D-2026-/).first()).toBeVisible();
    await expect(page.getByText(/Signature/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-dispense-record.png`, fullPage: true });
  });
});
