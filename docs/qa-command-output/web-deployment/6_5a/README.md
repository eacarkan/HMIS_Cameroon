# Phase 6.5A — motion foundation evidence (mobile, 390 px)

Scope (mentor-approved): global reduced-motion foundation · reusable scroll-reveal
(`components/public/reveal.tsx`) · fade/rise/stagger on public cards & sections ·
count-up on the SAFE metrics only (8 / 10 animate, « 100 % » snaps) · subtle
8-hospital network reveal + one-shot illumination wash (no map, no connecting lines) ·
same rhythm on /accueil, /vitrine and /acces-demo. Deferred to 6.5B: sticky journey.

## Hard-requirement proofs (all verified, 15/15 DOM checks pass)

- **Content visible by default in server HTML** — the server never emits a
  `data-reveal` state; shot `08` renders /accueil with **JavaScript disabled**:
  every section + the final stat values are present and visible.
- **Reduced-motion users get static content** — shot `07` renders with emulated
  `prefers-reduced-motion: reduce`: ZERO `data-reveal` attributes are ever set,
  all grids at opacity 1, stats show final values. globals.css additionally
  collapses ALL animations/transitions app-wide under reduced motion.
- **No hidden content if JS fails** — the hidden state only exists after the
  client component opts an element in; jsdom/no-IO regression tests pin this
  (`tests/component/reveal-6_5a.test.tsx`).
- **No layout shift / transform+opacity only** — verified: hero bottom identical
  FR == EN (943 px @375 px); no horizontal overflow FR or EN; the reveal never
  animates height/margin. Nothing above the fold is ever opted in.
- **No new dependency** — native IntersectionObserver + CSS transitions only.

## Screenshots

| File | Shows |
|---|---|
| `01-…-modules-mid-reveal` | Module cards after the staggered settle (mobile FR) |
| `02-…-network-illumination` | 8-hospital registre after reveal (wash is one-shot, faded by capture) |
| `03/04-…-hero fr/en` | Hero with server-rendered stats 8 · 10 · 100 % (FR + EN) |
| `05-vitrine-…` | /vitrine capability cards settled |
| `06-acces-demo-…` | /acces-demo role cards revealed; directory/one-click static |
| `07-…-reduced-motion-static` | Emulated reduced motion — fully static page |
| `08-…-nojs-content-visible` | JavaScript disabled — full content in server HTML |

Note: stills capture end states; the transition mechanics (pending→in flip, opacity
settle, capped 70 ms stagger, one-shot wash) are asserted in the 15 scripted DOM
checks recorded in the build log for this phase.
