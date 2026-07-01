import { expect, test } from "@playwright/test";

import { ACCOUNTS, DEMO_PW, login } from "./_helpers";

const SHOTS = "docs/batch4-screenshots";

/**
 * Phase 1A Batch 4 — account security (E2E). Verifies the change-password form and its
 * server-side policy (a weak password is rejected — so nothing is mutated, keeping the
 * shared test DB stable), and that an admin can open an audit event detail. The successful
 * password-change + admin reset paths are covered end-to-end in the integration suite.
 * Uses the admin account. Sorts after golden-path. Runs against the TEST database.
 */
test.describe.serial("account security", () => {
  test("change-password form enforces the policy; admin reviews an audit detail", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin);

    await page.goto("/mon-compte");
    await expect(page.getByText("Changer mon mot de passe")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-change-password.png`, fullPage: true });

    // Server-side policy: correct current password but a weak new one is rejected — no change.
    await page.getByLabel("Mot de passe actuel").fill(DEMO_PW);
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("weak");
    await page.getByLabel("Confirmer le nouveau mot de passe").fill("weak");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText(/8 caractères/)).toBeVisible();

    // Audit event detail (admin has audit.read).
    await page.goto("/journal-audit");
    await page.getByRole("link", { name: "Détail" }).first().click();
    await page.waitForURL(/\/journal-audit\/(?!nouveau)[^/]+$/);
    await expect(page.getByText("Détail de l'événement d'audit")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/02-audit-detail.png`, fullPage: true });
  });
});
