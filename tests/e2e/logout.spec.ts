import { test, expect } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

/**
 * Logout (09 §4): from an authenticated session, open the top-bar user menu, click
 * « Déconnexion », and confirm the session ends on the login screen (`/connexion`).
 */
test("logout returns the user to the login screen", async ({ page }) => {
  await login(page, ACCOUNTS.admin);

  // Open the user menu in the top bar, then sign out.
  await page.getByRole("button", { name: /NJOYA/ }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();

  await expect(page).toHaveURL(/\/connexion/);
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeVisible();
});
