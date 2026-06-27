import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

/**
 * E2E-06 — RBAC is visible AND enforced at the route level (09 §6). The receptionist's
 * nav is filtered, and navigating directly to a route they lack the capability for is
 * redirected away by the server-side layout guard (not merely hidden). The stronger
 * service-level `authz.denied` denial is covered in the integration suite.
 */
test("E2E-06 receptionist nav is filtered and guarded routes redirect", async ({
  page,
}) => {
  await login(page, ACCOUNTS.reception);

  // Visible RBAC: only Tableau de bord + Patients in the sidebar.
  const nav = page.getByRole("navigation");
  await expect(nav.getByText("Patients")).toBeVisible();
  await expect(nav.getByText("Facturation")).toHaveCount(0);
  await expect(nav.getByText("Administration")).toHaveCount(0);
  await expect(nav.getByText("Journal d'audit")).toHaveCount(0);

  // Guarded route: directly visiting the audit log redirects to the dashboard.
  await page.goto("/journal-audit");
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Tableau de bord" }),
  ).toBeVisible();
});
