# Phase 6.5B — passive hospital journey storytelling evidence

Scope (mentor-approved): the /accueil + /vitrine hospital journey becomes a mobile
vertical timeline — STATIC rail (never fills), each step settles + its badge lights up
as it enters the viewport (per-step passive observation), one formal FR/EN explanation
per step. Desktop keeps the sober horizontal stepper. No scroll snapping, no pinning,
no hijack, no dependencies, no dashboard animation.

## Scripted verification — 43/43 checks pass

- **375 / 390 / 430 px × FR / EN** (6 combinations): 6 steps, vertical layout, all six
  descriptions present, no horizontal overflow, `scroll-snap-type: none` on html + list,
  steps reveal in view during natural scroll.
- **Sequential + persistent:** steps flip pending→in strictly in order 0→5 as each
  enters the viewport; after scrolling back to the top all six stay revealed (no
  flicker, no re-animation).
- **Reduced motion (emulated):** zero reveal attributes ever set; badges render in the
  FINAL accent state (the muted look exists only inside the pending state).
- **JavaScript disabled:** the complete timeline — six steps + six explanations — is in
  the server HTML with zero hidden states.
- **Desktop 1280 px:** single horizontal row, rail hidden, connectors intact.
- **/vitrine:** same component renders the timeline without regression.

## Screenshots

`journey-{375,390,430}-{fr,en}.png` · `journey-reduced-motion.png` · `journey-nojs.png`
· `journey-desktop-1280.png` · `journey-vitrine-390.png`

Note: captured on the local dev server — the black circular « N » is the Next.js
dev-only indicator, absent from production builds (proven in the 6.5A evidence).

## Wording (six new keys, `landing.journey.stepDetails.*`, FR + EN)

Formal, module-descriptive, one line each (≤ 66 chars FR / 63 EN). A regression test
(`tests/component/journey-6_5b.test.tsx`) pins length bounds and forbids wording that
implies live operation, official Ministry adoption, production deployment or real
patient data.
