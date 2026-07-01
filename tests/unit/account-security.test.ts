import { describe, expect, it } from "vitest";

import {
  attemptsRemaining,
  canAssignRole,
  isLockedOut,
  MAX_FAILED_ATTEMPTS,
} from "@/lib/account-security";
import { validatePassword } from "@/lib/password-policy";

describe("unit: password policy", () => {
  it("accepts a compliant password", () => {
    expect(validatePassword("Motdepasse1").ok).toBe(true);
  });
  it("rejects too-short / missing class passwords with messages", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("alllowercase1").ok).toBe(false); // no uppercase
    expect(validatePassword("ALLUPPERCASE1").ok).toBe(false); // no lowercase
    expect(validatePassword("NoDigitsHere").ok).toBe(false); // no digit
    expect(validatePassword("abc").errors.length).toBeGreaterThan(0);
  });
});

describe("unit: lockout policy", () => {
  it("locks out at the threshold", () => {
    expect(isLockedOut(MAX_FAILED_ATTEMPTS - 1)).toBe(false);
    expect(isLockedOut(MAX_FAILED_ATTEMPTS)).toBe(true);
  });
  it("reports remaining attempts", () => {
    expect(attemptsRemaining(0)).toBe(MAX_FAILED_ATTEMPTS);
    expect(attemptsRemaining(MAX_FAILED_ATTEMPTS + 3)).toBe(0);
  });
});

describe("unit: role-assignment safeguard", () => {
  it("allows only the known coarse roles", () => {
    expect(canAssignRole("medecin")).toBe(true);
    expect(canAssignRole("administrateur")).toBe(true);
  });
  it("rejects unknown / over-privileged role codes", () => {
    expect(canAssignRole("superadmin")).toBe(false);
    expect(canAssignRole("root")).toBe(false);
    expect(canAssignRole("")).toBe(false);
  });
});
