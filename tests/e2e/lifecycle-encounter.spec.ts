import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch1b-screenshots";

/**
 * Phase 1A Batch 1B — encounter lifecycle (E2E). A reception agent registers a patient,
 * opens a visit, sees the read-only timeline, assigns a service, then closes the visit; once
 * closed, the encounter is terminal (no further status controls — invalid transitions are
 * rejected, exhaustively covered in the integration suite). Runs against the TEST database.
 */
test.describe.serial("encounter lifecycle", () => {
  test("open a visit, view timeline, assign service, then close it", async ({ page }) => {
    await login(page, ACCOUNTS.reception);

    // Register a unique fictional patient.
    await page.goto("/patients/nouveau");
    await page.locator('input[name="familyName"]').fill("ESSOMBA");
    await page.locator('input[name="givenName"]').fill("Vie Visite");
    await page.locator('select[name="sex"]').selectOption("male");
    await page.locator('input[name="dateOfBirth"]').fill("1978-09-09");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/patients\/(?!nouveau)[^/]+$/);

    // Read-only timeline shows the registration event.
    await expect(page.getByText("Chronologie du patient")).toBeVisible();
    await expect(page.getByText("Patient enregistré").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-timeline.png`, fullPage: true });

    // Open a visit.
    await page.getByRole("link", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/visite\/nouvelle$/);
    await page.locator('textarea[name="reason"]').fill("Contrôle de routine");
    await page.getByRole("button", { name: "Ouvrir une visite" }).click();
    await page.waitForURL(/\/encounters\/[^/]+$/);

    // Lifecycle card: re-assign to another active outpatient consultation service (recorded +
    // audited). Phase 2 QA — the control is a restricted dropdown, not free text; only outpatient
    // consultation services are offered (and the server enforces the same rule).
    await expect(page.getByText("Cycle de vie")).toBeVisible();
    await page.getByLabel(/Affecter au service/).selectOption("Pédiatrie");
    await page.getByRole("button", { name: "Affecter" }).click();
    await expect(page.getByText(/Pédiatrie/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-lifecycle-controls.png`, fullPage: true });

    // Close the visit → terminal state, controls disappear.
    await page.getByRole("button", { name: "Clôturer la visite" }).click();
    await expect(page.getByText(/aucune autre transition possible/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Clôturer la visite" })).toHaveCount(0);
    // Status history records the change.
    await expect(page.getByText(/Ouverte → Clôturée/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-status-history.png`, fullPage: true });
  });
});
