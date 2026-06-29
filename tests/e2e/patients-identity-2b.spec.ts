import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path + patient-duplicate (both use the seeded patient #000001).
test.describe("Phase 2B — patient identity", () => {
  test("reception registers a patient by estimated age + guardian phone", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("KAMGA");
    await page.locator('input[name="givenName"]').fill("Estelle");
    await page.locator('select[name="sex"]').selectOption("female");
    await page.locator('input[name="estimatedAge"]').fill("33");
    await page.locator('input[name="guardianPhone"]').fill("237699112233");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { name: /KAMGA/ })).toBeVisible();
    await page.screenshot({ path: "docs/phase2b-screenshots/01-registered-estimated-age.png", fullPage: true });
  });

  test("reception creates a temporary (unidentified) patient with an Inconnu_ id", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/patients/temporaire");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="estimatedAge"]').fill("50");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/Inconnu_\d{6}_\d{2}/).first()).toBeVisible();
    await page.screenshot({ path: "docs/phase2b-screenshots/02-temporary-patient.png", fullPage: true });
  });
});
