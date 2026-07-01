import { describe, expect, it } from "vitest";

import {
  canConfirm,
  canFailOrCancel,
  canReconcile,
  isTerminalPaymentStatus,
  validateProviderInput,
  validateTransactionInput,
} from "@/lib/external-payment";

/**
 * Phase 4D — pure payment helpers. Provider + transaction input validation (integer FCFA) and the
 * external-payment status machine (confirm from PENDING; reconcile only a CONFIRMED, not-yet-reconciled
 * transaction). No I/O.
 */
describe("unit: Phase 4D external-payment helpers", () => {
  it("validateProviderInput requires an UPPER code + name + channel", () => {
    expect(validateProviderInput({ code: "MTN_MOMO", name: "MTN", channel: "MOBILE_MONEY" }).ok).toBe(true);
    expect(validateProviderInput({ code: "lower", name: "x", channel: "c" }).ok).toBe(false);
    expect(validateProviderInput({ code: "OK", name: "", channel: "c" }).ok).toBe(false);
  });

  it("validateTransactionInput requires a reference + a positive integer amount", () => {
    expect(validateTransactionInput({ externalReference: "PAY-1", amount: 2000 }).ok).toBe(true);
    expect(validateTransactionInput({ externalReference: "", amount: 2000 }).ok).toBe(false);
    expect(validateTransactionInput({ externalReference: "PAY-1", amount: 0 }).ok).toBe(false);
    expect(validateTransactionInput({ externalReference: "PAY-1", amount: 12.5 }).ok).toBe(false);
  });

  it("status machine: confirm / fail-cancel / reconcile / terminal", () => {
    expect(canConfirm("PENDING")).toBe(true);
    expect(canConfirm("CONFIRMED")).toBe(false);
    expect(canFailOrCancel("PENDING")).toBe(true);
    expect(canFailOrCancel("CONFIRMED")).toBe(false);
    expect(canReconcile("CONFIRMED", null)).toBe(true);
    expect(canReconcile("CONFIRMED", "pay-1")).toBe(false); // already reconciled
    expect(canReconcile("PENDING", null)).toBe(false);
    expect(isTerminalPaymentStatus("FAILED")).toBe(true);
    expect(isTerminalPaymentStatus("CANCELLED")).toBe(true);
    expect(isTerminalPaymentStatus("CONFIRMED")).toBe(false);
  });
});
