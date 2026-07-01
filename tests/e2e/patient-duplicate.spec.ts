import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch1a-screenshots";

/**
 * Phase 1A Batch 1A — patient search + duplicate warning (E2E). A reception agent searches,
 * registers a new patient (no warning), then registers the SAME identity again and is shown a
 * WARNING — no merge, no block — and may continue with "Créer quand même". Uses a unique
 * fictional patient (independent of the golden-path BELLO). Runs against the TEST database.
 */
test.describe.serial("patient duplicate warning", () => {
  const FAMILY = "NDONGO";
  const GIVEN = "Test Doublon";
  const DOB = "1985-05-05";

  test("reception searches (no match) then registers without a warning", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients");

    // Structured search: by phone — nothing yet.
    await page.getByLabel("Téléphone").fill("650001122");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByText(/Aucune correspondance|Aucun patient/)).toBeVisible();

    await page.getByRole("link", { name: "Créer un patient" }).first().click();
    await page.waitForURL(/\/patients\/nouveau$/);
    await page.locator('input[name="familyName"]').fill(FAMILY);
    await page.locator('input[name="givenName"]').fill(GIVEN);
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill(DOB);
    await page.locator('input[name="phone"]').fill("+237 6 50 00 11 22");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    // First registration: no duplicate → goes straight to the patient file.
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await expect(page.getByText("Test Doublon NDONGO").first()).toBeVisible();

    // Evidence: structured search (name field) returns the patient.
    await page.goto("/patients");
    await page.getByLabel("Nom, prénom ou n° patient…").fill("NDONGO");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByText("Test Doublon NDONGO").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-recherche-filtres.png`, fullPage: true });
  });

  test("registering the same identity shows a warning, then 'Créer quand même' creates it", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill(FAMILY);
    await page.locator('input[name="givenName"]').fill(GIVEN);
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill(DOB);
    await page.getByRole("button", { name: "Enregistrer" }).click();

    // Warning appears — no automatic block, no merge control.
    await expect(page.getByText("Doublon possible détecté")).toBeVisible();
    await expect(page.getByText(/même nom et date de naissance/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer quand même" })).toBeVisible();
    await expect(page.getByText(/fusionner/i)).toHaveCount(0); // no merge control
    await page.screenshot({ path: `${SHOTS}/02-avertissement-doublon.png`, fullPage: true });

    // The user overrides the warning and continues — a NEW record is created (no merge).
    await page.getByRole("button", { name: "Créer quand même" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/); // a real patient id, not the form
    await expect(page.getByText("Test Doublon NDONGO").first()).toBeVisible();
    await expect(page.getByText(/HRB-DEMO-P-2026-\d{6}/).first()).toBeVisible();
  });

  test("the duplicate-warning override is recorded in the audit log", async ({ page }) => {
    await login(page, ACCOUNTS.director); // read-only oversight role
    await page.goto("/journal-audit");
    await expect(page.getByRole("heading", { name: "Journal d'audit" })).toBeVisible();
    const auditTable = page.locator("table");
    await expect(auditTable.getByText("Doublon signalé").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-journal-audit-doublon.png`, fullPage: true });
  });
});
