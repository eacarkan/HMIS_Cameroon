"use client";

import { useEffect, useRef } from "react";

/**
 * Count-up for SAFE public metrics only (Phase 6.5A). The FINAL value is rendered in
 * the server HTML, so no-JS / slow-hydration viewers always see the real number and
 * nothing ever appears blank or at zero. After hydration the tween runs ONCE when the
 * metric scrolls into view; `prefers-reduced-motion` users keep the static value.
 * Integers only — non-integer figures (e.g. « 100 % ») stay plain text by design.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          const start = performance.now();
          const duration = 900;
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = String(Math.round(value * eased));
            if (progress < 1) raf = requestAnimationFrame(step);
            else el.textContent = String(value);
          };
          raf = requestAnimationFrame(step);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span ref={ref}>{value}</span>;
}
