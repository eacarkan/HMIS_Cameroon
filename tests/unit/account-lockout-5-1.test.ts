import { describe, expect, it } from "vitest";

import {
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_ATTEMPTS,
  isCurrentlyLocked,
  lockoutUntil,
  nextFailedLoginState,
} from "@/lib/account-security";

/**
 * Phase 5.1 (F-02) — pure account-lockout policy. Deterministic time via an injected `now`.
 */
const now = new Date("2026-07-01T10:00:00.000Z");

describe("unit: Phase 5.1 account-lockout policy", () => {
  it("a failed attempt increments the counter (below threshold → not locked)", () => {
    expect(nextFailedLoginState({ failedLoginCount: 0, lockedUntil: null }, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
    expect(nextFailedLoginState({ failedLoginCount: 3, lockedUntil: null }, now)).toEqual({ failedLoginCount: 4, lockedUntil: null });
  });

  it("reaching the threshold sets a fresh lockedUntil", () => {
    const next = nextFailedLoginState({ failedLoginCount: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null }, now);
    expect(next.failedLoginCount).toBe(MAX_FAILED_ATTEMPTS);
    expect(next.lockedUntil).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60_000));
  });

  it("a failure AFTER an expired lock restarts the counter at 1", () => {
    const expired = new Date(now.getTime() - 60_000);
    expect(nextFailedLoginState({ failedLoginCount: MAX_FAILED_ATTEMPTS, lockedUntil: expired }, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it("isCurrentlyLocked: a future lock is locked; an expired or absent one is not", () => {
    expect(isCurrentlyLocked(new Date(now.getTime() + 60_000), now)).toBe(true);
    expect(isCurrentlyLocked(new Date(now.getTime() - 60_000), now)).toBe(false);
    expect(isCurrentlyLocked(null, now)).toBe(false);
  });

  it("lockoutUntil is now + the configured window", () => {
    expect(lockoutUntil(now)).toEqual(new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60_000));
  });
});
