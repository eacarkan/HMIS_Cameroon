import { test } from "@playwright/test";

/**
 * Phase 6G — capture the SantéGrid public pages (Fr + En) as review evidence into
 * docs/qa-command-output/web-deployment/FINAL/screenshots/. No assertions — this spec
 * exists to produce the mentor-package screenshots on the production build. The locale
 * is switched via the `locale` cookie (same cookie the in-app language toggle sets).
 */
const OUT = "docs/qa-command-output/web-deployment/FINAL/screenshots";

const PAGES = [
  { path: "/accueil", name: "landing" },
  { path: "/vitrine", name: "showcase" },
  { path: "/acces-demo", name: "demo-access" },
  { path: "/retours", name: "feedback" },
];

for (const locale of ["fr", "en"] as const) {
  for (const p of PAGES) {
    test(`capture ${p.name} (${locale})`, async ({ page, context }) => {
      await context.addCookies([
        { name: "locale", value: locale, domain: "localhost", path: "/" },
      ]);
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/${p.name}-${locale}.png`, fullPage: true });
    });
  }
}
