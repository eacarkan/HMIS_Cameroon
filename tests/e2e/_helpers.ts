import { type Page, expect } from "@playwright/test";

export const ACCOUNTS = {
  reception: "brigitte.mbarga@hrb-demo.cm",
  doctor: "jeanpaul.etoa@hrb-demo.cm",
  cashier: "solange.abena@hrb-demo.cm",
  director: "emmanuel.tchoua@hrb-demo.cm",
  admin: "awa.njoya@hrb-demo.cm",
};

/** Log in (fresh context) and select HRB-DEMO, landing on the dashboard. */
export async function login(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(email);
  await page.getByLabel("Mot de passe").fill("demo1234");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // A fresh session has no active hospital → the selection screen appears.
  const selection = page.getByRole("heading", {
    name: "Sélection de l'hôpital",
  });
  try {
    await selection.waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /Bertoua/ }).click();
  } catch {
    // already had an active hospital — no selection step
  }

  await expect(
    page.getByRole("heading", { name: "Tableau de bord" }),
  ).toBeVisible({
    timeout: 30_000,
  });
}

/** Open the BELLO patient detail from the patient list. */
export async function openBelloPatient(page: Page) {
  await page.goto("/patients");
  await page.getByRole("link", { name: "Ouvrir" }).first().click();
  await page.waitForURL(/\/patients\/[^/]+$/);
}
