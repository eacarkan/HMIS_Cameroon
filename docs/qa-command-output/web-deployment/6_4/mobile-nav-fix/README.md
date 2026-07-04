# Phase 6.4 — mandatory fixes evidence (mobile public nav + sidebar footer layout)

Two mentor-mandated fixes, verified below. All shots are from the local build with the
**local synthetic test database** (never Neon); one-click was enabled only transiently
(gitignored `.env.development.local`, deleted after capture).

## Fix #1 — mobile public navigation no longer overflows

The inline public nav previously overflowed narrow viewports and clipped « Se connecter ».
The header now collapses below `sm` to **Logo (left) + a single compact menu button (right)**;
the menu exposes the same links plus the FR/EN switch.

- `01-accueil-mobile-fr-390.png` — compact header (Logo + hamburger), no overflow, reduced hero.
- `02-accueil-mobile-en-390.png` — same in English.
- `03-public-mobile-menu-open-fr.png` — menu open: Fonctionnalités · Accès démo · **Se connecter** · FR/EN toggle.
- `04-public-mobile-menu-open-en.png` — menu open in English (Features · Demo access · Sign in).
- `05-accueil-mobile-fr-375.png` / `06-accueil-mobile-fr-430.png` — narrow + wide targets, no overflow.

Automated proof (Playwright, `tests/e2e/public-site.spec.ts`): 6 new cases —
`6.4 — mobile public header is a compact menu with no overflow` at **375 / 390 / 430 px × FR / EN**,
each asserting the compact menu button is visible, the inline `header nav` is hidden,
`documentElement.scrollWidth ≤ innerWidth` (no horizontal overflow), and the sign-in item
is reachable from the opened menu. All 6 pass.

## Fix #2 — authenticated sidebar footer no longer interferes with navigation

The fix is **structural**, not cosmetic: the sidebar column and its `<nav>` gained `min-h-0`
so the nav scrolls **inside its own area**, and the compact one-line review badge is a real
flex sibling **below** the scroll region — never an overlay.

- `07-auth-sidebar-bottom-nav-compact-footer.png` — admin sidebar (25 items) scrolled to the
  bottom: last item « Mon compte » fully readable, scrollbar visible on the rail, compact
  « Revue — données synthétiques » footer sitting cleanly below the nav.
- `09-auth-user-menu-open.png` — sidebar top (active « Tableau de bord ») + the user menu
  showing « Site public » / « Quitter la démonstration » / « Déconnexion ».

Measured layout diagnostic at 1280×700 (admin, nav scrolled to bottom):

```
navItems: 25
navScrollable: true      (scrollHeight 1260 > clientHeight 588 → nav scrolls internally)
footerBelowNavArea: true (footer top 669 ≥ nav bottom → footer is a sibling, not an overlay)
lastItemText: "Mon compte"
lastItemAboveFooter: true (last item bottom 654 ≤ footer top 669 → last item fully clear)
footerText: "Revue — données synthétiques"  (compact, one line)
```

Acceptance criteria met: header at top · nav in a true scrollable area · last menu item fully
readable · scrollbar visible · compact badge outside the scroll, not overlaying or crowding.

## Authenticated return path (regression check)

- `08-apres-quitter-demo-accueil.png` — « Quitter la démonstration » lands on **/accueil**
  with the session cleared (public homepage). Verified path = `/accueil`.

## Optional hero tune

Mobile hero padding trimmed `py-16 → py-12` and the description reserve `14.5rem → 13rem`.
FR and EN wrap to the **same** height at 375/390 px (208 px), so the reduced reserve keeps
**zero FR/EN layout shift** — confirmed at 375/390/430 px in both locales (heroH FR == EN,
no shift, no overflow). The title reserve is unchanged because FR genuinely needs the taller
box at 375 px (150 px vs EN 112 px).
