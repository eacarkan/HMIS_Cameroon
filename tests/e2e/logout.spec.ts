import { test, expect } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

/**
 * Logout (09 §4; Phase 6.4 scope 1): from an authenticated session, open the top-bar
 * user menu and leave. Since 6.4, signing out returns the reviewer to the PUBLIC
 * homepage (`/accueil`) instead of the login dead-end — and the session must still be
 * fully cleared (a protected route bounces back to `/connexion`).
 */
test("logout returns the user to the public homepage with the session cleared", async ({
  page,
}) => {
  await login(page, ACCOUNTS.admin);

  // Open the user menu in the top bar, then sign out (« Déconnexion »).
  await page.getByRole("button", { name: /NJOYA/ }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();

  // 6.4 — logout lands on the public homepage, not /connexion.
  await expect(page).toHaveURL(/\/accueil/);
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("SantéGrid");

  // The session is really gone: a protected route bounces the visitor out — to
  // /accueil when the public site is enabled (6A front-door), else to /connexion.
  await page.goto("/patients");
  await expect(page).toHaveURL(/\/(accueil|connexion)/);
  await expect(page.getByRole("heading", { name: "Patients" })).toHaveCount(0);
});

test("the user menu offers a way back to the public site and a leave-demo action", async ({
  page,
}) => {
  await login(page, ACCOUNTS.admin);
  await page.getByRole("button", { name: /NJOYA/ }).click();

  // « Site public » — plain link back to /accueil (session kept).
  await expect(page.getByRole("link", { name: "Site public" })).toBeVisible();
  // « Quitter la démonstration » — signs out and returns to /accueil.
  await page.getByRole("button", { name: "Quitter la démonstration" }).click();
  await expect(page).toHaveURL(/\/accueil/);
});
