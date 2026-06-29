import { describe, expect, it } from "vitest";

import {
  canTransitionRefund,
  isRefundVoucherStatus,
  isTerminalRefund,
} from "@/lib/refund-voucher";

describe("refund voucher state machine (Phase 2C)", () => {
  it("recognizes valid statuses", () => {
    for (const s of ["requested", "approved", "paid", "cancelled"]) {
      expect(isRefundVoucherStatus(s)).toBe(true);
    }
    expect(isRefundVoucherStatus("bogus")).toBe(false);
  });

  it("allows requested → approved → paid", () => {
    expect(canTransitionRefund("requested", "approved")).toBe(true);
    expect(canTransitionRefund("approved", "paid")).toBe(true);
  });

  it("allows cancelling from requested and approved", () => {
    expect(canTransitionRefund("requested", "cancelled")).toBe(true);
    expect(canTransitionRefund("approved", "cancelled")).toBe(true);
  });

  it("rejects skipping approval and any transition out of terminal states", () => {
    expect(canTransitionRefund("requested", "paid")).toBe(false); // must be approved first
    expect(canTransitionRefund("paid", "approved")).toBe(false);
    expect(canTransitionRefund("paid", "cancelled")).toBe(false);
    expect(canTransitionRefund("cancelled", "approved")).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(canTransitionRefund("requested", "bogus")).toBe(false);
    expect(canTransitionRefund("bogus", "approved")).toBe(false);
  });

  it("flags terminal statuses", () => {
    expect(isTerminalRefund("paid")).toBe(true);
    expect(isTerminalRefund("cancelled")).toBe(true);
    expect(isTerminalRefund("requested")).toBe(false);
    expect(isTerminalRefund("approved")).toBe(false);
  });
});
