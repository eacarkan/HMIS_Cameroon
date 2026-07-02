import { expect, test } from "@playwright/test";

import { ACCOUNTS, login, openBelloPatient } from "./_helpers";

/**
 * Golden-path E2E (02, 07 §12). Serial — each test logs in fresh (DB state persists
 * across tests) and advances the journey: login → patient → visit → consultation →
 * invoice/payment/receipt → dashboard/audit. Runs against the TEST database.
 */
test.describe.serial("golden path", () => {
  test("E2E-01 login + hospital selection → dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion$/); // unauthenticated redirect

    await login(page, ACCOUNTS.reception);

    await expect(
      page.getByText("Environnement de revue", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Hôpital actif", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("HRB-DEMO").first()).toBeVisible();
    await expect(page.getByText("Brigitte MBARGA").first()).toBeVisible();
  });

  test("E2E-02 patient search-before-create", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients");

    // Search before any patient exists.
    await page.getByPlaceholder(/Nom, prénom/).fill("BELLO");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(
      page.getByText(/Aucune correspondance|Aucun patient/),
    ).toBeVisible();

    await page.getByRole("link", { name: "Créer un patient" }).first().click();
    await page.waitForURL(/\/patients\/nouveau$/);

    await page.locator('input[name="familyName"]').fill("BELLO");
    await page.locator('input[name="givenName"]').fill("Aïssatou");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="dateOfBirth"]').fill("1990-03-14");
    await page.locator('input[name="phone"]').fill("+237 6 99 00 00 01");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await page.waitForURL(/\/patients\/[^/]+$/);
    await expect(
      page.getByText("HRB-DEMO-P-2026-000001").first(),
    ).toBeVisible();
    await expect(page.getByText("Aïssatou BELLO").first()).toBeVisible();
    await expect(page.getByText("Visite en cours").first()).toBeVisible();
  });

  test("E2E-03 open a visit", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await openBelloPatient(page);

    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page
      .locator('textarea[name="reason"]')
      .fill("Fièvre et céphalées depuis 48 heures");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();

    await page.waitForURL(/\/encounters\/[^/]+$/);
    await expect(
      page.getByText("HRB-DEMO-V-2026-000001").first(),
    ).toBeVisible();
  });

  test("E2E-03b record the consultation (doctor)", async ({ page }) => {
    await login(page, ACCOUNTS.doctor);
    await openBelloPatient(page);
    await page.getByRole("link", { name: /HRB-DEMO-V-2026-000001/ }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);

    await page
      .getByRole("link", { name: "Enregistrer la consultation" })
      .click();
    await page.waitForURL(/\/consultation\/nouvelle$/);
    await page
      .locator('textarea[name="clinicalNote"]')
      .fill("État général conservé.");
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();

    await page.waitForURL(/\/encounters\/[^/]+$/);
    await expect(page.getByText("Finalisée").first()).toBeVisible();
  });

  test("E2E-04 invoice + payment + receipt (cashier)", async ({ page }) => {
    await login(page, ACCOUNTS.cashier);
    await openBelloPatient(page);
    await page.getByRole("link", { name: /HRB-DEMO-V-2026-000001/ }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);

    await page.getByRole("link", { name: "Créer la facture" }).click();
    await page.waitForURL(/\/facturation$/);
    // Select the two base services from the DB tariff catalogue (2 000 + 1 000 FCFA).
    await page.locator('input[name="qty_consultation_generale"]').fill("1");
    await page.locator('input[name="qty_ouverture_dossier"]').fill("1");
    await expect(page.getByText("3 000 FCFA").first()).toBeVisible(); // live total
    await page.getByRole("button", { name: "Créer la facture" }).click();

    await page.waitForURL(/\/factures\/[^/]+$/);
    await expect(
      page.getByText("HRB-DEMO-F-2026-000001").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Encaisser" }).click();
    await expect(page.getByText("Payée").first()).toBeVisible();

    await page.getByRole("link", { name: "Imprimer le reçu" }).click();
    await page.waitForURL(/\/recus\/[^/]+$/);
    await expect(
      page.getByText("HRB-DEMO-R-2026-000001").first(),
    ).toBeVisible();
    await expect(page.getByText("Montant payé").first()).toBeVisible();
    await expect(
      page.getByText("République du Cameroun").first(),
    ).toBeVisible();
    // The receipt document keeps the full formal marker; the app shell shows the
    // discreet review-environment badge (Phase 6.2).
    await expect(
      page.getByText("Environnement de revue", { exact: false }).first(),
    ).toBeVisible();
  });

  test("E2E-05 dashboard + audit (director)", async ({ page }) => {
    await login(page, ACCOUNTS.director);

    await expect(
      page.getByText("Patients enregistrés aujourd'hui").first(),
    ).toBeVisible();
    await expect(page.getByText("3 000 FCFA").first()).toBeVisible();

    await page.goto("/journal-audit");
    await expect(
      page.getByRole("heading", { name: "Journal d'audit" }),
    ).toBeVisible();
    // Scope to the table (the filter <select> also contains these labels).
    const auditTable = page.locator("table");
    await expect(
      auditTable.getByText("Création de facture").first(),
    ).toBeVisible();
    await expect(auditTable.getByText("Paiement").first()).toBeVisible();
    await expect(
      auditTable.getByText("Création patient").first(),
    ).toBeVisible();
    // (server-side authz.denied is covered exhaustively in the integration suite)
  });
});
