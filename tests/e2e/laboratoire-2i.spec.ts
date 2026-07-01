import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2i-screenshots";
const SECRET = "RESULTAT-SECRET-XYZ";

/**
 * Phase 2I — manual lab/radiology (E2E). Doctor requests a test → cashier confirms payment → technician
 * enters a result → the DOCTOR cannot see it yet → validator validates → the doctor sees it + prints the
 * report. The visibility gate is the headline. Self-contained; sorts after golden ("l" > "g").
 */
test.describe.serial("Phase 2I — manual lab & radiology", () => {
  test("request → pay → enter → (hidden) → validate → doctor sees result → report", async ({ page }) => {
    // Reception registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("EXAMEN");
    await page.locator('input[name="givenName"]').fill("Demo");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="dateOfBirth"]').fill("1990-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Bilan");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Doctor requests a lab test.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.locator("#diag-item").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Demander l'examen" }).click();
    await expect(page.getByText(/HRB-DEMO-E-2026-/).first()).toBeVisible();

    // Cashier confirms payment.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto(encounterUrl);
    await page.getByRole("button", { name: "Confirmer le paiement" }).click();
    await expect(page.getByText("Paiement confirmé").first()).toBeVisible();

    // Technician starts + enters the result.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.labTech);
    await page.goto(encounterUrl);
    await page.getByRole("button", { name: "Démarrer l'examen" }).click();
    await page.locator('textarea[name="resultText"]').fill(SECRET);
    await page.getByRole("button", { name: "Enregistrer le résultat" }).click();
    await expect(page.getByText("Résultat saisi").first()).toBeVisible();

    // THE GATE: the doctor cannot see the result yet (only the awaiting-validation notice).
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await expect(page.getByText(/en attente de validation/).first()).toBeVisible();
    await expect(page.getByText(SECRET)).toHaveCount(0);

    // Validator validates.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.labValidator);
    await page.goto(encounterUrl);
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText("Validé").first()).toBeVisible();

    // Now the doctor sees the result and can print the report.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await expect(page.getByText(SECRET).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-validated-result-visible.png`, fullPage: true });
    await page.getByRole("link", { name: "Imprimer le compte rendu" }).first().click();
    await page.waitForURL(/\/diagnostics\/[^/]+\/rapport$/);
    await expect(page.getByText("Compte rendu d'examen").first()).toBeVisible();
    await expect(page.getByText(SECRET).first()).toBeVisible();
  });
});
