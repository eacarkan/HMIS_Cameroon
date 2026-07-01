import { expect, test } from "@playwright/test";

/**
 * Phase 6 — public SantéGrid site (no authentication). Verifies the landing page (6A)
 * renders the brand, the synthetic-demo + not-official-government disclaimers, and the
 * calls-to-action, all without a login. Additional public routes (showcase, demo access,
 * health) are asserted by later Phase 6 batches. Runs against the production build.
 */
test.describe("public SantéGrid site", () => {
  test("6A — landing page renders the brand + disclaimers without auth", async ({
    page,
  }) => {
    await page.goto("/accueil");

    // Mandatory prototype banner.
    await expect(
      page.getByText(/non destiné à la production/i).first(),
    ).toBeVisible();

    // SantéGrid brand + verbatim positioning line.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "SantéGrid",
    );
    await expect(
      page
        .getByText("SantéGrid — Plateforme synthétique de démonstration SIGH / DME")
        .first(),
    ).toBeVisible();

    // Mandatory disclaimers (exact — "démonstration synthétique" also appears in prose).
    await expect(
      page.getByText("Démonstration synthétique", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Ce n'est pas un site officiel du gouvernement"),
    ).toBeVisible();

    // Calls-to-action to the showcase + demo access.
    await expect(
      page.getByRole("link", { name: "Découvrir les fonctionnalités" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Accéder à la démo" }),
    ).toBeVisible();
  });

  test("6B — feature showcase renders modules + proof without auth", async ({
    page,
  }) => {
    await page.goto("/vitrine");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Fonctionnalités de la plateforme",
    );
    // Module preview cards (curated, synthetic).
    await expect(page.getByText("Facturation & caisse")).toBeVisible();
    await expect(page.getByText("Pharmacie & stock")).toBeVisible();
    await expect(
      page.getByText("Multi-hôpitaux & supervision centrale"),
    ).toBeVisible();
    // Banker/accountant proof section.
    await expect(
      page.getByText("Une plateforme réelle, déployée et vérifiée"),
    ).toBeVisible();
    // No public write action in the showcase content (the header language toggle,
    // outside <main>, is a locale form — not a write action).
    await expect(page.locator("main form")).toHaveCount(0);
  });

  test("6C — demo access shows the directory; one-click is OFF by default", async ({
    page,
  }) => {
    await page.goto("/acces-demo");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Accès démo",
    );
    // Public synthetic account directory.
    await expect(page.getByText("solange.abena@hrb-demo.cm")).toBeVisible();
    await expect(page.getByText("Caissier (Bertoua)")).toBeVisible();
    // The e2e build sets no HMIS_ENVIRONMENT / one-click flag → one-click disabled,
    // no one-click session buttons are rendered.
    await expect(
      page.getByText(/La connexion en un clic est désactivée/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Démarrer :/ })).toHaveCount(0);
  });

  test("6D — public health route returns a safe status payload", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("santegrid");
    expect(body.syntheticDataOnly).toBe(true);
    expect(body.liveIntegrations).toBe(false);
    // No secrets / connection strings.
    expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\//i);
  });

  test("6F — feedback page is email-only (warning, no form)", async ({ page }) => {
    await page.goto("/retours");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Retours des parties prenantes",
    );
    await expect(
      page.getByText(/N'incluez aucune donnée réelle ou sensible de patient/i),
    ).toBeVisible();
    // Email-only: no in-app feedback form in the content (header locale form excluded).
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main textarea")).toHaveCount(0);
  });
});
