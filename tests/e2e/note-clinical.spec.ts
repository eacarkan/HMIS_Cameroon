import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch2-screenshots";

/**
 * Phase 1A Batch 2 — clinical note (E2E). A clinician records a DRAFT consultation, opens the
 * consultation summary, finalizes it, views the printable note, then amends it (a traced
 * correction). The spec is self-contained (its own fictional patient) and sorts AFTER
 * golden-path so it does not disturb the golden-path numbering. Runs against the TEST database.
 */
test.describe.serial("clinical note", () => {
  test("draft → finalize → print → amend", async ({ page }) => {
    // A receptionist registers a patient and opens a visit.
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("ATANGANA");
    await page.locator('input[name="givenName"]').fill("Note Clinique");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="dateOfBirth"]').fill("1992-02-02");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Toux persistante");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    const encounterUrl = page.url();

    // Switch role: drop the reception session so the login form is shown again.
    await page.context().clearCookies();

    // The clinician records the consultation as a DRAFT.
    await login(page, ACCOUNTS.doctor);
    await page.goto(encounterUrl);
    await page.getByRole("link", { name: "Enregistrer la consultation" }).click();
    await page.waitForURL(/\/consultation\/nouvelle$/);
    await page.locator('textarea[name="clinicalNote"]').fill("Auscultation sans particularité.");
    await page.getByText("Enregistrer comme brouillon").click(); // check the draft box
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);
    await expect(page.getByText("Brouillon").first()).toBeVisible();

    // Open the consultation summary, finalize it, then view the printable note.
    await page.getByRole("link", { name: "Voir / imprimer" }).first().click();
    await page.waitForURL(/\/consultations\/[^/]+$/);
    await expect(page.getByText("Compte rendu de consultation")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-note-summary.png`, fullPage: true });
    await page.getByRole("button", { name: "Finaliser la consultation" }).click();
    await expect(page.getByText("Finalisée").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-finalized-note.png`, fullPage: true });

    // Amend the finalized note — a traced correction.
    await expect(page.getByText("Amender la consultation")).toBeVisible();
    await page.locator('textarea[name="clinicalNote"]').fill("Correction : ajout d'un antécédent d'asthme.");
    await page.getByRole("button", { name: "Enregistrer l'amendement" }).click();
    await expect(page.getByText(/Amendement consultation|Amendement de la consultation/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-amended-history.png`, fullPage: true });
  });
});
