"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal primitive (Phase 6.5A — motion foundation). Fail-safe by design:
 *
 * - The server HTML carries NO `data-reveal` attribute, so content is FULLY VISIBLE
 *   by default — no-JS viewers, slow hydration on patchy mobile data, crawlers and
 *   tests all see the complete page.
 * - After hydration, elements still BELOW the viewport are opted into a "pending"
 *   state and flipped to "in" when they scroll into view (IntersectionObserver).
 *   Anything the viewer can already (or nearly) see is never hidden — which also
 *   keeps the hero and above-the-fold content permanently static.
 * - `prefers-reduced-motion` users never get the attribute at all (and the CSS
 *   foundation forces the static state as a second belt).
 * - Motion is transform/opacity only (see globals.css) — it can never shift layout
 *   or disturb the FR/EN height reserves.
 *
 * `stagger` reveals the element's CHILDREN in a short capped cadence instead of the
 * element itself — used for card grids so the registre "settles into place".
 *
 * `each` (6.5B) observes every child INDIVIDUALLY with one shared observer — used for
 * the journey timeline, where steps sit at different scroll depths and must each settle
 * as THEY enter the viewport (not when the container does). Same fail-open guards; a
 * child already in view at hydration is never opted in. Purely passive — the observer
 * only reads scroll position; it never snaps, pins or intercepts the scroll.
 */
export function Reveal({
  as = "div",
  stagger = false,
  each = false,
  className,
  children,
}: {
  as?: "div" | "ul" | "ol" | "section";
  stagger?: boolean;
  each?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // Typed as HTMLDivElement for the JSX ref below; at runtime it may be a ul/ol/section —
  // all HTMLElement, and only HTMLElement APIs are used.
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Environment guards — anything missing means "stay static", never "stay hidden".
    if (typeof IntersectionObserver === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    // 6.5B — per-child observation: each child settles as IT enters the viewport.
    if (each) {
      const items = Array.from(el.children).filter(
        // Never hide a child the viewer can already (or nearly) see.
        (child) => child.getBoundingClientRect().top >= window.innerHeight * 0.85,
      );
      if (items.length === 0) return;
      for (const item of items) item.setAttribute("data-reveal-item", "pending");
      const itemObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.setAttribute("data-reveal-item", "in");
              itemObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.3, rootMargin: "0px 0px -6% 0px" },
      );
      for (const item of items) itemObserver.observe(item);
      return () => itemObserver.disconnect();
    }

    // Never hide content the viewer can already (or nearly) see.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;

    el.setAttribute("data-reveal", "pending");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute("data-reveal", "in");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [each]);

  // Narrow-cast so JSX accepts the dynamic tag with div-style props; the actual
  // element rendered is `as`. Keeps the ref compiler-visible (react-hooks/refs).
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={className}
      // Present in server HTML (it only selects WITH data-reveal, so it is inert
      // until the client opts in) — keeps hydration attribute-stable.
      data-reveal-stagger={stagger ? "" : undefined}
    >
      {children}
    </Tag>
  );
}
