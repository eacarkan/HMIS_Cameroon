import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts last; registers its own fresh patient (no dependency on the golden-path patient).
test.describe("Phase 2 QA — outpatient visit service picker", () => {
  test("new-visit form lists outpatient services and EXCLUDES support/inpatient", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.reception);

    // Register a fresh patient (no active encounter) to reach its new-visit form.
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("VISITQA");
    await page.locator('input[name="givenName"]').fill("Test");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1990-01-01");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { name: /VISITQA/ })).toBeVisible();

    // Open the new-visit form for this patient and inspect the service selector.
    const patientUrl = page.url();
    await page.goto(`${patientUrl}/visite/nouvelle`);
    const texts = await page.locator('select[name="serviceLabel"] option').allTextContents();

    // Includes configured OUTPATIENT consultation services…
    expect(texts).toContain("Médecine générale");
    expect(texts.some((t) => /Pédiatrie|Chirurgie|Dentaire|Gynéco/.test(t))).toBe(true);

    // …and EXCLUDES support + inpatient services.
    for (const excluded of [
      "Caisse",
      "Pharmacie",
      "Laboratoire",
      "Imagerie médicale",
      "Accueil",
      "Maternité",
    ]) {
      expect(texts).not.toContain(excluded);
    }
  });
});
