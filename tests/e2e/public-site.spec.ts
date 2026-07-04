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

    // Discreet review-environment banner (Phase 6.2).
    await expect(
      page.getByText(/Environnement de revue/i).first(),
    ).toBeVisible();

    // SantéGrid brand + hero positioning line (Phase 6.3 executive title).
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "SantéGrid",
    );
    await expect(
      page
        .getByText("SantéGrid — Plateforme intégrée de gestion hospitalière")
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
      page.getByRole("link", { name: "Découvrir la plateforme" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Accéder à la démonstration" }),
    ).toBeVisible();
  });

  test("6B — feature showcase renders modules + proof without auth", async ({
    page,
  }) => {
    await page.goto("/vitrine");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Fonctionnalités de la plateforme",
    );
    // Module preview cards (curated, synthetic). Target the card HEADINGS specifically —
    // the guided-demo pathway on /vitrine also lists "Facturation & caisse" as a step,
    // so a plain getByText would match two elements (strict-mode violation).
    await expect(
      page.getByRole("heading", { name: "Facturation & caisse" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pharmacie & stock" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Multi-hôpitaux & supervision centrale" }),
    ).toBeVisible();
    // Banker/accountant proof section.
    await expect(
      page.getByText("Environnement de revue en ligne et vérifié"),
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
      "Accès à l'environnement de revue",
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

  // Phase 6.4 fix #1 — on narrow viewports the inline public nav overflowed and clipped
  // « Se connecter ». The header must instead collapse to Logo + a single compact menu
  // button, and the menu must expose the same links (features / demo access / sign-in) with
  // no horizontal overflow. Checked at the three target widths in both locales.
  for (const width of [375, 390, 430]) {
    for (const locale of ["fr", "en"] as const) {
      test(`6.4 — mobile public header is a compact menu with no overflow (${width}px ${locale})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.context().addCookies([
          { name: "locale", value: locale, domain: "localhost", path: "/" },
        ]);
        await page.goto("/accueil");

        // The inline desktop nav is hidden below `sm`; the compact menu button is shown.
        const menuButton = page.getByRole("button", {
          name: locale === "fr" ? "Menu" : "Menu",
        });
        await expect(menuButton).toBeVisible();
        await expect(page.locator("header nav")).toBeHidden();

        // No horizontal overflow of the document at this width.
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflows).toBe(false);

        // Opening the menu reveals the sign-in link (the item that used to clip).
        await menuButton.click();
        await expect(
          page.getByRole("menuitem", {
            name: locale === "fr" ? "Se connecter" : "Sign in",
          }),
        ).toBeVisible();
      });
    }
  }

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
