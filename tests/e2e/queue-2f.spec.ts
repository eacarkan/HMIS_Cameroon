import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2f-screenshots";

/**
 * Phase 2F — simple digital queue (E2E). Reception queues the golden-path patient for a service, then
 * calls and completes the ticket. A read-only role (cashier) sees the board but no "add" control.
 * Sorts after the golden path (which registers HRB-DEMO-P-2026-000001).
 */
test.describe("Phase 2F — digital queue", () => {
  test("reception queues a patient and advances the ticket", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/file-attente");
    await expect(page.getByRole("heading", { name: "File d'attente" }).first()).toBeVisible();

    await page.locator('input[name="patientNumber"]').fill("HRB-DEMO-P-2026-000001");
    await page.getByRole("button", { name: "Ajouter à la file" }).click();
    await expect(page.getByText("Patient ajouté à la file.")).toBeVisible();

    // Call → complete the ticket on the live board.
    await page.getByRole("button", { name: "Appeler" }).first().click();
    await expect(page.getByText("En cours").first()).toBeVisible();
    await page.getByRole("button", { name: "Terminer" }).first().click();
    await expect(page.getByText("Terminé").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-queue.png`, fullPage: true });
  });

  test("a read-only role sees the board but cannot add to the queue (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.cashier);
    await page.goto("/file-attente");
    await expect(page.getByRole("heading", { name: "File d'attente" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajouter à la file" })).toHaveCount(0);
  });
});
