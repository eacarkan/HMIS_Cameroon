import { expect, test } from "@playwright/test";

import { ACCOUNTS, login } from "./_helpers";

const SHOTS = "docs/phase2e-screenshots";

/**
 * Phase 2E — operational reporting + DHIS2 CSV export (E2E). The admin views the aggregate report and
 * downloads the DHIS2-aligned CSV; the CSV is verified to be the aggregate header (no patient column).
 * Reception is redirected from the report and gets 403 on the export. Sorts after the golden path.
 */
test.describe("Phase 2E — operational reporting + DHIS2 export", () => {
  test("admin views the aggregate report and exports an aggregate-only DHIS2 CSV", async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/rapports");
    await expect(page.getByRole("heading", { name: "Rapports opérationnels" }).first()).toBeVisible();
    await expect(page.getByText(/aucun identifiant patient/i)).toBeVisible();
    await expect(page.getByText("Répartition âge / sexe (consultations)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exporter le CSV DHIS2" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/01-operational-report.png`, fullPage: true });

    // Download the DHIS2 CSV (current month) and verify it is AGGREGATE: the strict aggregate header,
    // and NO email / nominative token leaks through.
    const res = await page.request.get("/rapports/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    const lines = body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("period,orgUnit,dataElement,ageBand,gender,value");
    // PRIVACY: with accumulated patient data present, assert EVERY data row is strictly aggregate —
    // exactly six columns, gender ∈ {M,F,U}, an integer value. A leaked patient name could not fit.
    for (const line of lines.slice(1)) {
      const f = line.split(",");
      expect(f).toHaveLength(6);
      expect(["M", "F", "U"]).toContain(f[4]);
      expect(f[5]).toMatch(/^\d+$/);
    }
    expect(body).not.toMatch(/@/); // no emails either
  });

  test("reception cannot view the report or run the export (RBAC)", async ({ page }) => {
    await login(page, ACCOUNTS.reception);
    await page.goto("/rapports");
    await expect(page).not.toHaveURL(/\/rapports$/);
    const res = await page.request.get("/rapports/export");
    expect(res.status()).toBe(403);
  });
});
