import { describe, expect, it } from "vitest";

import {
  buildJobIdempotencyKey,
  canClaimJob,
  canRetryJob,
  IntegrationLiveDisabledError,
  isLiveIntegrationEnabled,
  isTerminalJobStatus,
  looksLikeSecret,
  MockIntegrationConnector,
  resolveConnectorAdapter,
  validateConnectorInput,
  validateCredentialReference,
  validateExternalSystemInput,
} from "@/lib/integration";

/**
 * Phase 4A — pure integration helpers. Validates the registry/connector input rules, the credential
 * REFERENCE guard that keeps secrets out of the DB, the adapter resolution (mock-only; PRODUCTION
 * never runs), the live feature flag (fails closed), and the job status machine. No I/O.
 */
describe("unit: Phase 4A integration helpers", () => {
  it("validateExternalSystemInput requires an UPPER code + name + kind", () => {
    expect(validateExternalSystemInput({ code: "DHIS2_NATIONAL", name: "DHIS2", kind: "GENERIC" }).ok).toBe(true);
    expect(validateExternalSystemInput({ code: "lower", name: "x", kind: "g" }).ok).toBe(false);
    expect(validateExternalSystemInput({ code: "OK", name: "  ", kind: "g" }).ok).toBe(false);
    expect(validateExternalSystemInput({ code: "OK", name: "x", kind: "" }).ok).toBe(false);
  });

  it("validateConnectorInput only allows MOCK / SANDBOX / PRODUCTION_DISABLED (never a live production)", () => {
    expect(validateConnectorInput({ name: "m", environment: "MOCK" }).ok).toBe(true);
    expect(validateConnectorInput({ name: "m", environment: "SANDBOX" }).ok).toBe(true);
    expect(validateConnectorInput({ name: "m", environment: "PRODUCTION" }).ok).toBe(false);
    expect(validateConnectorInput({ name: "", environment: "MOCK" }).ok).toBe(false);
  });

  it("looksLikeSecret flags real secrets but NOT reference names", () => {
    expect(looksLikeSecret("DHIS2_API_TOKEN")).toBe(false);
    expect(looksLikeSecret("vault://hmis/dhis2/token")).toBe(false);
    expect(looksLikeSecret("aB3xY7zQ9mN2kL5pR8tW1vC4")).toBe(true);
    expect(looksLikeSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(looksLikeSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
    expect(looksLikeSecret("aB3xY7zQ9mN2kL5pR8tW1vC4")).toBe(true); // long high-entropy mixed token
  });

  it("validateCredentialReference rejects a secret value and accepts an env-var NAME", () => {
    expect(
      validateCredentialReference({ name: "token", referenceKind: "ENV_VAR", referenceValue: "DHIS2_API_TOKEN" }).ok,
    ).toBe(true);
    expect(
      validateCredentialReference({ name: "token", referenceKind: "ENV_VAR", referenceValue: "aB3xY7zQ9mN2kL5pR8tW1vC4" }).ok,
    ).toBe(false);
    // an ENV_VAR reference must be a NAME, not free text.
    expect(
      validateCredentialReference({ name: "token", referenceKind: "ENV_VAR", referenceValue: "not a var name" }).ok,
    ).toBe(false);
  });

  it("resolveConnectorAdapter returns a mock for MOCK/SANDBOX and ALWAYS refuses PRODUCTION_DISABLED", () => {
    expect(resolveConnectorAdapter("MOCK").isMock).toBe(true);
    expect(resolveConnectorAdapter("SANDBOX").isMock).toBe(true);
    expect(() => resolveConnectorAdapter("PRODUCTION_DISABLED")).toThrow(IntegrationLiveDisabledError);
    // even if a future live flag is set, NO production adapter is implemented → still throws (no live call).
    expect(() => resolveConnectorAdapter("PRODUCTION_DISABLED", { liveEnabled: true })).toThrow();
  });

  it("the mock connector runs purely in-memory and reports a simulated result", async () => {
    const result = await new MockIntegrationConnector("MOCK").run({ jobKind: "EXPORT" });
    expect(result.ok).toBe(true);
    expect(result.output?.simulated).toBe(true);
    expect(result.detail).toMatch(/fictif/i);
  });

  it("isLiveIntegrationEnabled fails closed (off unless the exact flag is 'true')", () => {
    expect(isLiveIntegrationEnabled({})).toBe(false);
    expect(isLiveIntegrationEnabled({ HMIS_INTEGRATION_LIVE_ENABLED: "false" })).toBe(false);
    expect(isLiveIntegrationEnabled({ HMIS_INTEGRATION_LIVE_ENABLED: "1" })).toBe(false);
    expect(isLiveIntegrationEnabled({ HMIS_INTEGRATION_LIVE_ENABLED: "true" })).toBe(true);
  });

  it("job status machine: claim, retry, terminal", () => {
    expect(canClaimJob("PENDING", 0, 3)).toBe(true);
    expect(canClaimJob("FAILED", 1, 3)).toBe(true);
    expect(canClaimJob("FAILED", 3, 3)).toBe(false);
    expect(canClaimJob("RUNNING", 0, 3)).toBe(false);
    expect(canClaimJob("SUCCEEDED", 0, 3)).toBe(false);
    expect(canRetryJob("FAILED", 1, 3)).toBe(true);
    expect(canRetryJob("PENDING", 0, 3)).toBe(false);
    expect(isTerminalJobStatus("SUCCEEDED")).toBe(true);
    expect(isTerminalJobStatus("CANCELLED")).toBe(true);
    expect(isTerminalJobStatus("FAILED")).toBe(false);
  });

  it("buildJobIdempotencyKey is deterministic and discriminates by ref", () => {
    const a = buildJobIdempotencyKey({ externalSystemId: "s1", kind: "EXPORT", ref: "r1" });
    expect(a).toBe(buildJobIdempotencyKey({ externalSystemId: "s1", kind: "EXPORT", ref: "r1" }));
    expect(a).not.toBe(buildJobIdempotencyKey({ externalSystemId: "s1", kind: "EXPORT", ref: "r2" }));
  });
});
