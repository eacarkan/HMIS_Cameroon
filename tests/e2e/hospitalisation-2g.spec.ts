import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2g-screenshots";

/**
 * Phase 2G — ward-level hospitalization (E2E). Doctor requests admission → admission desk assigns a
 * ward (daily fee snapshot from tariff) → daily fee generated → discharge BLOCKED while the
 * hospitalization invoice is unpaid → cashier pays → doctor authorises discharge. Sorts after golden.
 */
test.describe.serial("Phase 2G — ward-level hospitalization", () => {
  test("request → assign ward → daily fee → discharge blocked → pay → discharge", async ({ page }) => {
    // Reception registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("HOSPIT");
    await page.locator('input[name="givenName"]').fill("Demo");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1980-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Bilan");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Doctor requests the admission.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.locator("#adm-reason").fill("Surveillance 48h");
    await page.getByRole("button", { name: "Demander l'hospitalisation" }).click();
    await expect(page.getByText(/HRB-DEMO-H-2026-/).first()).toBeVisible();

    // Admission desk (reception) assigns the Internal Medicine ward and generates today's fee.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.reception);
    await page.goto(encounterUrl);
    await page.locator("#adm-ward").selectOption({ label: "Médecine interne (hospitalisation)" });
    await page.getByRole("button", { name: "Attribuer le service" }).click();
    await expect(page.getByText("Hospitalisé").first()).toBeVisible();
    await expect(page.getByText("10 000 FCFA").first()).toBeVisible();

    await page.getByRole("button", { name: "Générer les frais du jour" }).click();
    await expect(page.getByRole("link", { name: /HRB-DEMO-F-2026-/ }).first()).toBeVisible();

    // Doctor: discharge is blocked while the hospitalization invoice is unpaid.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await expect(page.getByText(/Sortie bloquée/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Autoriser la sortie" })).toBeDisabled();

    // Cashier pays the hospitalization invoice.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.cashier);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: /HRB-DEMO-F-2026-/ }).first().click();
    await page.waitForURL(/\/factures\/[^/]+$/);
    await page.getByRole("button", { name: "Encaisser" }).click();
    await expect(page.getByText("Payée").first()).toBeVisible();

    // Doctor authorises discharge (gate now clear).
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.getByRole("button", { name: "Demander la sortie" }).click();
    await expect(page.getByText("Sortie demandée").first()).toBeVisible();
    await page.getByRole("button", { name: "Autoriser la sortie" }).click();
    await expect(page.getByText("Sorti").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-admission-discharged.png`, fullPage: true });

    // The hospitalization board lists the discharged admission.
    await page.goto("/hospitalisations");
    await expect(page.getByText(/HRB-DEMO-H-2026-/).first()).toBeVisible();
  });
});
