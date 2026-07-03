import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

// Sorts AFTER golden-path.spec.ts (s > g). Phase 3D — central aggregate oversight (snapshot-fed).
const CENTRAL = "direction.regionale@hrb-demo.cm";

test.describe("Phase 3D — central aggregate oversight", () => {
  test("an admin generates the hospital aggregate snapshot", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Rapports opérationnels" })).toBeVisible();
    await page.getByRole("button", { name: "Générer l'instantané central" }).click();
    // The action completes without error and stays on the reports page.
    await expect(page.getByRole("heading", { name: "Rapports opérationnels" })).toBeVisible();
  });

  test("the central supervisor sees per-hospital AGGREGATES only (no patient data)", async ({ page }) => {
    await login(page, CENTRAL);
    await page.goto("/central");
    await expect(
      page.getByRole("heading", { name: "Supervision multi-sites — environnement de revue" }),
    ).toBeVisible();
    // The aggregate-only notice + a per-hospital card (Bertoua, from the generated snapshot).
    await expect(page.getByText(/Agrégats uniquement/)).toBeVisible();
    await expect(page.getByText(/Bertoua/).first()).toBeVisible();
    await page.screenshot({ path: "docs/phase3d-screenshots/01-central-aggregates.png", fullPage: true });
  });

  test("a non-central role cannot reach the central oversight (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/central");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Supervision multi-sites — environnement de revue" }),
    ).toHaveCount(0);
  });
});
