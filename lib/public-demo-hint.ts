/**
 * Public demo password-hint resolution (Phase 6.3 S3). The deployed
 * `NEXT_PUBLIC_DEMO_PASSWORD_HINT` may be unset, empty, or still hold a template
 * placeholder (e.g. `<optional-public-demo-password-or-hint>`). In any of those cases the
 * literal must NEVER reach the page — show the controlled fallback wording instead. Pure and
 * client-safe so it is unit-testable and importable by both server and client trees.
 */

/** True when a hint value is unusable (missing / blank / a template placeholder). */
export function isPlaceholderHint(raw: string | null | undefined): boolean {
  const v = raw?.trim();
  if (!v) return true;
  // Angle-bracket templates like `<...>` and common placeholder tokens are not real hints.
  return /^<.*>$/.test(v) || /placeholder|optional-public-demo|your-hint|to-be-set|tbd/i.test(v);
}

/** The public demo password hint, or the provided controlled fallback when unusable. */
export function resolvePublicDemoPasswordHint(
  raw: string | null | undefined,
  fallback: string,
): string {
  return isPlaceholderHint(raw) ? fallback : raw!.trim();
}
