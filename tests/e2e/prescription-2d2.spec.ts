import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-2 — prescription (E2E). Reception opens a visit; the doctor writes a prescription,
 * finalizes it and sends it to the pharmacy; the printable ordonnance is shown. Self-contained;
 * sorts after the golden path. No stock effect (2D-5).
 */
test.describe.serial("Phase 2D-2 — prescription", () => {
  test("doctor prescribes → finalize → send to pharmacy → printable ordonnance", async ({
    page,
  }) => {
    // Reception registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("ORDONNANCE");
    await page.locator('input[name="givenName"]').fill("Test");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="dateOfBirth"]').fill("1992-02-02");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Paludisme simple");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Doctor writes a prescription.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Nouvelle ordonnance" }).click();
    await page.waitForURL(/\/ordonnance\/nouvelle$/);
    await page.getByLabel("Posologie").first().fill("1 comprimé");
    await page.getByLabel("Fréquence").first().fill("3x/jour");
    await page.getByLabel("Durée").first().fill("5 jours");
    await page.getByLabel("Quantité").first().fill("15");
    await page.getByRole("button", { name: "Créer l'ordonnance" }).click();
    await page.waitForURL(/\/ordonnances\/[^/]+$/);
    await expect(page.getByText(/HRB-DEMO-O-2026-/).first()).toBeVisible();

    // Drive the lifecycle: finalize → send to pharmacy.
    await page.getByRole("button", { name: "Finaliser" }).click();
    await expect(page.getByText("Finalisée").first()).toBeVisible();
    await page.getByRole("button", { name: "Envoyer à la pharmacie" }).click();
    await expect(page.getByText("Envoyée à la pharmacie").first()).toBeVisible();

    // The printable ordonnance shows the doctor signature space.
    await expect(page.getByText(/Signature \/ cachet du médecin/)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-prescription.png`, fullPage: true });
  });
});
