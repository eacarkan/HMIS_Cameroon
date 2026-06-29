import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch4-screenshots";

/**
 * Phase 1A Batch 4 — account security (E2E). A user changes their own password (policy
 * enforced) and an admin reviews an audit event detail. Uses the DIRECTOR account (not used
 * by later specs) and restores the demo password afterwards so the shared test DB stays
 * usable for other specs. Sorts after golden-path. Runs against the TEST database.
 */
test.describe.serial("account security", () => {
  test("change own password (and restore), then review an audit detail", async ({ page }) => {
    await login(page, ACCOUNTS.director);

    await page.goto("/mon-compte");
    await expect(page.getByText("Changer mon mot de passe")).toBeVisible();
    await page.getByLabel("Mot de passe actuel").fill("demo1234");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("Motdepasse1");
    await page.getByLabel("Confirmer le nouveau mot de passe").fill("Motdepasse1");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-change-password.png`, fullPage: true });

    // Restore the demo password so later specs (and demos) keep working.
    await page.getByLabel("Mot de passe actuel").fill("Motdepasse1");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("demo1234");
    await page.getByLabel("Confirmer le nouveau mot de passe").fill("demo1234");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();

    // Audit event detail (director has audit.read).
    await page.goto("/journal-audit");
    await page.getByRole("link", { name: "Détail" }).first().click();
    await page.waitForURL(/\/journal-audit\/[^/]+$/);
    await expect(page.getByText("Détail de l'événement d'audit")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-audit-detail.png`, fullPage: true });
  });
});
