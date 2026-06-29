import { describe, expect, it } from "vitest";

import {
  assertFakeDataOnly,
  isRealDataRequested,
  REAL_DATA_ENABLED,
  resolveDataMode,
} from "@/lib/data-mode";
import { validateEnv } from "@/lib/env-validation";

describe("unit: data-mode separation (fail closed)", () => {
  it("resolves only 'pilot'; everything else (incl. 'real') falls back to 'demo'", () => {
    expect(resolveDataMode("pilot")).toBe("pilot");
    expect(resolveDataMode("demo")).toBe("demo");
    expect(resolveDataMode("real")).toBe("demo"); // cannot be bypassed via config
    expect(resolveDataMode("production")).toBe("demo");
    expect(resolveDataMode(undefined)).toBe("demo");
  });

  it("flags a real-data request for diagnostics but never enables it", () => {
    expect(isRealDataRequested("real")).toBe(true);
    expect(REAL_DATA_ENABLED).toBe(false);
    expect(() => assertFakeDataOnly()).not.toThrow(); // disabled → no throw
  });
});

describe("unit: environment validation (fail closed)", () => {
  it("ok when required vars are present", () => {
    expect(validateEnv({ DATABASE_URL: "postgres://x", AUTH_SECRET: "s" })).toEqual({
      ok: true,
      missing: [],
    });
  });
  it("reports missing vars", () => {
    expect(validateEnv({ DATABASE_URL: "", AUTH_SECRET: "s" })).toEqual({
      ok: false,
      missing: ["DATABASE_URL"],
    });
    expect(validateEnv({}).ok).toBe(false);
  });
});
