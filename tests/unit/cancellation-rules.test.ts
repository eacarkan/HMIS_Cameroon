import { describe, expect, it } from "vitest";

import {
  canDecideCancellation,
  isCancellationStatus,
  isSeparateApprover,
  isValidCancellationReason,
} from "@/lib/cancellation-rules";

describe("invoice-cancellation rules (Phase 2C)", () => {
  it("only a pending (requested) request can be decided", () => {
    expect(canDecideCancellation("requested")).toBe(true);
    expect(canDecideCancellation("approved")).toBe(false);
    expect(canDecideCancellation("rejected")).toBe(false);
  });

  it("enforces requester ≠ approver", () => {
    expect(isSeparateApprover("user-cashier", "user-admin")).toBe(true);
    expect(isSeparateApprover("user-x", "user-x")).toBe(false);
  });

  it("requires a non-empty reason", () => {
    expect(isValidCancellationReason("Erreur de saisie")).toBe(true);
    expect(isValidCancellationReason("   ")).toBe(false);
    expect(isValidCancellationReason("")).toBe(false);
  });

  it("recognizes valid statuses", () => {
    expect(isCancellationStatus("requested")).toBe(true);
    expect(isCancellationStatus("approved")).toBe(true);
    expect(isCancellationStatus("rejected")).toBe(true);
    expect(isCancellationStatus("paid")).toBe(false);
  });
});
