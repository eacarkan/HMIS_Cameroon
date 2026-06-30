import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2d-screenshots";

/**
 * Phase 2D-6 — FEFO override (E2E). A doctor prescribes a stocked medication (reserved FEFO,
 * earliest-expiry first); the Pharmacist-in-Charge re-points the reservation onto a deliberately
 * chosen non-FEFO lot with a reason. Sorts after the golden path and the 2D-5 journey.
 */
test.describe.serial("Phase 2D-6 — FEFO override", () => {
  test("Pharmacist-in-Charge overrides the FEFO lot with a reason", async ({ page }) => {
    // Reception opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("FEFO");
    await page.locator('input[name="givenName"]').fill("Demo");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="dateOfBirth"]').fill("1988-08-08");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Paludisme");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Doctor prescribes a SEEDED, STOCKED medication (FEFO reserves the earliest-expiry lot).
    await page.context().clearCookies();
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Nouvelle ordonnance" }).click();
    await page.waitForURL(/\/ordonnance\/nouvelle$/);
    await page.getByLabel("Médicament").first().selectOption({ label: "Paracétamol 500 mg" });
    await page.getByLabel("Posologie").first().fill("1 comprimé");
    await page.getByLabel("Durée").first().fill("5 jours");
    await page.getByLabel("Quantité").first().fill("8");
    await page.getByRole("button", { name: "Créer l'ordonnance" }).click();
    await page.waitForURL(/\/ordonnances\/[^/]+$/);
    const prescriptionUrl = page.url();
    await page.getByRole("button", { name: "Finaliser" }).click();
    await expect(page.getByText("Finalisée").first()).toBeVisible();
    await page.getByRole("button", { name: "Envoyer à la pharmacie" }).click();
    await expect(page.getByText("Envoyée à la pharmacie").first()).toBeVisible();

    // Pharmacist-in-Charge re-points the reservation onto a chosen lot with a reason.
    await page.context().clearCookies();
    await login(page, ACCOUNTS.pharmacistChief);
    await page.goto(prescriptionUrl);
    await expect(page.getByText("Réservations & FEFO")).toBeVisible();
    await expect(page.getByText("FEFO", { exact: true })).toBeVisible(); // the reserved lot is the FEFO choice
    await page.getByLabel("Motif de la dérogation FEFO").fill("Lot prioritaire endommagé (démo)");
    await page.getByRole("button", { name: "Déroger (FEFO)" }).click();
    await expect(page.getByText("Dérogation FEFO").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/05-fefo-override.png`, fullPage: true });
  });
});
