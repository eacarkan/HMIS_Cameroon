/**
 * Refund voucher ("bon d'avoir") state machine (pure, client-safe) — Phase 2C.
 *
 * A refund voucher is raised when an APPROVED invoice-cancellation targets an invoice that had
 * recorded payments. Lifecycle: requested → approved → paid (the physical cash-out is recorded at
 * "paid"/executed) — or cancelled from requested/approved. `paid` and `cancelled` are terminal.
 * No data access; no external payment integration. Integer FCFA enforced by the caller.
 */

export type RefundVoucherStatus = "requested" | "approved" | "paid" | "cancelled";

/** Allowed transitions per current status. */
const TRANSITIONS: Record<RefundVoucherStatus, readonly RefundVoucherStatus[]> = {
  requested: ["approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function isRefundVoucherStatus(value: string): value is RefundVoucherStatus {
  return value === "requested" || value === "approved" || value === "paid" || value === "cancelled";
}

/** True if `to` is a legal next status from `from`. */
export function canTransitionRefund(from: string, to: string): boolean {
  if (!isRefundVoucherStatus(from) || !isRefundVoucherStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

/** Terminal statuses carry no further transitions. */
export function isTerminalRefund(status: string): boolean {
  return status === "paid" || status === "cancelled";
}
