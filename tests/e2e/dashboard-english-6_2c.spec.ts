import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ACCOUNTS, DEMO_PW } from "./_helpers";

/**
 * Phase 6.2C regression — with English selected, the authenticated dashboard body must render
 * in English (production build, test DB). Reproduces the reviewer's concern: select English,
 * sign in as the Bertoua Administrator, and assert the dashboard body is English with no
 * French UI labels (proper names / region names / FCFA are allowed).
 */
const OUT = "docs/qa-command-output/web-deployment/6_2C";

/** French UI terms that must NOT appear in the English dashboard body. */
const FRENCH_UI_TERMS = [
  "Tableau de bord",
  "Aperçu de l'activité",
  "Activité du jour",
  "Activité clinique",
  "Facturation & caisse",
  "Patients enregistrés",
  "Visites ouvertes",
  "Consultations du jour",
  "Encaissements du jour",
  "Activité récente",
  "Espèces",
  "Aucune donnée",
];

test("6.2C — Bertoua Administrator dashboard body renders in English", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  // 1) Select English before signing in.
  await context.addCookies([
    { name: "locale", value: "en", domain: "localhost", path: "/" },
  ]);

  // 2) Sign in with credentials (the form is English: Username / Password / Sign in).
  await page.goto("/connexion");
  await page.getByLabel("Username").fill(ACCOUNTS.admin);
  await page.getByLabel("Password").fill(DEMO_PW);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3) The admin is multi-hospital → hospital selection (English); pick Bertoua.
  await page
    .getByRole("heading", { name: "Hospital selection" })
    .waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Bertoua/ }).click();

  // 4) Dashboard — assert it is present AND English.
  await page
    .getByRole("heading", { name: "Dashboard" })
    .waitFor({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const main = page.locator("main");
  const mainText = await main.innerText();

  // Save the evidence artifact.
  writeFileSync(
    `${OUT}/dashboard-after.txt`,
    `# Phase 6.2C dashboard — English (regression)\nhtml lang=en\n\n${mainText}\n`,
  );
  await page.screenshot({ path: `${OUT}/dashboard-after.png`, fullPage: true });

  // Positive: key English dashboard labels are present. (Section headings are visually
  // uppercased via CSS; the DOM text keeps its original case.) Updated for the S4/S4.2
  // executive layout: the plain page-header subtitle and the "Today's activity" section
  // (whose KPIs moved into the hero band) were replaced by the executive band + sections.
  await expect(main).toContainText("Today's overview");
  await expect(main).toContainText("Billing & cashiering");
  await expect(main).toContainText("Recent activity");

  // Negative: no French dashboard UI labels leak into the English body.
  for (const term of FRENCH_UI_TERMS) {
    expect(mainText, `French UI term leaked into English dashboard: "${term}"`).not.toContain(
      term,
    );
  }
});
