/**
 * Invoice-cancellation workflow rules (pure, client-safe) — Phase 2C.
 *
 * A cashier requests an invoice cancellation with a mandatory reason; a Hospital Administrator
 * decides (approve / reject). The cashier may NOT approve their OWN request (requester ≠ approver).
 * A request can only be decided once (must be in `requested`). No data access.
 */

export type CancellationRequestStatus = "requested" | "approved" | "rejected";

export function isCancellationStatus(value: string): value is CancellationRequestStatus {
  return value === "requested" || value === "approved" || value === "rejected";
}

/** A request can be decided (approved/rejected) only while still pending. */
export function canDecideCancellation(status: string): boolean {
  return status === "requested";
}

/** Requester ≠ approver: the person deciding must differ from the requester. */
export function isSeparateApprover(requestedById: string, approverId: string): boolean {
  return requestedById !== approverId;
}

/** A non-empty (trimmed) reason is mandatory for a cancellation request. */
export function isValidCancellationReason(reason: string): boolean {
  return reason.trim().length > 0;
}
