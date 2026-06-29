import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/batch6-screenshots";

/**
 * Phase 1A Batch 6 — system status / pilot readiness (E2E). An oversight user sees the
 * status page with real signals and the visible fake-data marker. Read-only; sorts last.
 * Runs against the TEST database.
 */
test.describe.serial("system status", () => {
  test("status page shows health, data-mode marker and disabled real-data path", async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin); // config.read; password untouched by other specs
    await page.goto("/etat-systeme");
    await expect(page.getByRole("heading", { name: "État du système" })).toBeVisible();
    await expect(page.getByText("DÉMO / PILOTE — données fictives").first()).toBeVisible();
    await expect(page.getByText("Désactivé (Gate 7 requis)")).toBeVisible();
    await expect(page.getByText("Aptitude au pilote (niveau application)")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-system-status.png`, fullPage: true });
  });
});
