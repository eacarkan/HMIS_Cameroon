/**
 * Queue rules (pure, client-safe) — Phase 2F.
 *
 * Per-service digital queue state machine + ordering. No data access. `in_service` covers
 * in-consultation / in-lab / at-the-counter. Terminal: `completed`, `cancelled`.
 */

export const QUEUE_STATUSES = ["waiting", "in_service", "completed", "cancelled"] as const;
export type QueueStatusValue = (typeof QUEUE_STATUSES)[number];

const TRANSITIONS: Record<QueueStatusValue, QueueStatusValue[]> = {
  waiting: ["in_service", "cancelled"],
  in_service: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isTerminalQueueStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/** True if `from → to` is an allowed queue transition. */
export function canTransitionQueue(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as QueueStatusValue];
  return Array.isArray(allowed) && allowed.includes(to as QueueStatusValue);
}

/**
 * Board ordering for ACTIVE tickets: urgent first, then by ticket number ascending. Stable + pure;
 * the caller filters out terminal tickets when showing the live board.
 */
export function compareQueueTickets(
  a: { isUrgent: boolean; ticketNumber: number },
  b: { isUrgent: boolean; ticketNumber: number },
): number {
  if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
  return a.ticketNumber - b.ticketNumber;
}

/** Zero-padded display, e.g. 12 → "012". */
export function formatTicketNumber(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(3, "0");
}
