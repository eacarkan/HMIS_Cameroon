import { describe, expect, it } from "vitest";

import {
  canTransitionQueue,
  compareQueueTickets,
  formatTicketNumber,
  isTerminalQueueStatus,
  QUEUE_STATUSES,
} from "@/lib/queue";

describe("queue rules (Phase 2F)", () => {
  it("allows only valid transitions", () => {
    expect(canTransitionQueue("waiting", "in_service")).toBe(true);
    expect(canTransitionQueue("waiting", "cancelled")).toBe(true);
    expect(canTransitionQueue("in_service", "completed")).toBe(true);
    expect(canTransitionQueue("in_service", "cancelled")).toBe(true);
    // Invalid:
    expect(canTransitionQueue("waiting", "completed")).toBe(false);
    expect(canTransitionQueue("completed", "in_service")).toBe(false);
    expect(canTransitionQueue("cancelled", "waiting")).toBe(false);
    expect(canTransitionQueue("waiting", "waiting")).toBe(false);
  });

  it("knows terminal statuses", () => {
    expect(isTerminalQueueStatus("completed")).toBe(true);
    expect(isTerminalQueueStatus("cancelled")).toBe(true);
    expect(isTerminalQueueStatus("waiting")).toBe(false);
    expect(isTerminalQueueStatus("in_service")).toBe(false);
  });

  it("orders urgent first, then by ticket number", () => {
    const rows = [
      { isUrgent: false, ticketNumber: 1 },
      { isUrgent: true, ticketNumber: 5 },
      { isUrgent: false, ticketNumber: 2 },
      { isUrgent: true, ticketNumber: 3 },
    ];
    const order = [...rows].sort(compareQueueTickets).map((r) => r.ticketNumber);
    expect(order).toEqual([3, 5, 1, 2]); // urgents (3,5) first by number, then non-urgents (1,2)
  });

  it("zero-pads the ticket number", () => {
    expect(formatTicketNumber(12)).toBe("012");
    expect(formatTicketNumber(7)).toBe("007");
    expect(formatTicketNumber(123)).toBe("123");
  });

  it("exposes the four statuses", () => {
    expect([...QUEUE_STATUSES]).toEqual(["waiting", "in_service", "completed", "cancelled"]);
  });
});
