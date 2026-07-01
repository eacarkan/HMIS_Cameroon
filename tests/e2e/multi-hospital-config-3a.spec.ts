import { type Page, expect, test } from "@playwright/test";

import { ACCOUNTS, DEMO_PW } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (m > g), so the seeded golden path already ran.
// Phase 3A — configure a SECOND hospital (Ebolowa) from the Bertoua reference template,
// raising its configuration completeness without any code change. Synthetic data only.

/** Log in and select a hospital by display name on the selection screen (fresh context). */
async function loginAndSelect(page: Page, email: string, hospitalName: RegExp) {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(email);
  await page.getByLabel("Mot de passe").fill(DEMO_PW);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page
    .getByRole("heading", { name: "Sélection de l'hôpital" })
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: hospitalName }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Phase 3A — multi-hospital configuration", () => {
  test("admin configures Ebolowa from the Bertoua reference template", async ({ page }) => {
    // Awa administers both Bertoua and Ebolowa; choose the second site.
    await loginAndSelect(page, ACCOUNTS.admin, /Ebolowa/);

    await page.goto("/administration/configuration");
    await expect(
      page.getByRole("heading", { name: "Configuration multi-hôpitaux" }),
    ).toBeVisible();

    // Ebolowa starts barely configured (6/22) — a site being prepared for rollout.
    await expect(page.getByText("6/22 · 27%")).toBeVisible();
    await page.screenshot({
      path: "docs/phase3a-screenshots/01-ebolowa-before.png",
      fullPage: true,
    });

    // Apply the shared reference template (a guarded, scoped write — config only).
    // The first non-placeholder option is the Bertoua reference template.
    await page.locator('select[name="templateId"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: "Appliquer", exact: true }).click();

    // Completeness rises to 19/22 without any code change; the structural categories are filled.
    await expect(page.getByText("19/22 · 86%")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: "docs/phase3a-screenshots/02-ebolowa-after-apply.png",
      fullPage: true,
    });

    // The apply is recorded in the per-hospital history.
    await expect(page.getByText(/Modèle TPL-BERTOUA-REF v1 appliqué/)).toBeVisible();
  });

  test("the completeness dashboard compares Bertoua and Ebolowa for a multi-site admin", async ({
    page,
  }) => {
    await loginAndSelect(page, ACCOUNTS.admin, /Bertoua/);
    await page.goto("/administration/configuration");

    // Bertoua is the fully-configured reference.
    await expect(page.getByText("22/22 · 100%")).toBeVisible();
    // The comparison card lists the other accessible hospital (Ebolowa) by data alone.
    await expect(page.getByText("Comparaison entre hôpitaux")).toBeVisible();
    await expect(page.getByText(/Ebolowa/).first()).toBeVisible();
    await page.screenshot({
      path: "docs/phase3a-screenshots/03-bertoua-comparison.png",
      fullPage: true,
    });
  });

  test("a non-config role cannot reach the configuration dashboard (RBAC)", async ({ page }) => {
    await loginAndSelect(page, ACCOUNTS.cashier, /Bertoua/);
    await page.goto("/administration/configuration");
    // config.view is denied → redirected to the dashboard.
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Configuration multi-hôpitaux" }),
    ).toHaveCount(0);
  });
});
