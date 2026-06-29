import { describe, expect, it } from "vitest";

import { composeTimeline, type TimelineInput } from "@/lib/patient-timeline";

const input: TimelineInput = {
  createdAt: "2026-06-27T08:00:00.000Z",
  encounters: [
    {
      encounterNumber: "HRB-DEMO-V-2026-000001",
      status: "closed",
      openedAt: "2026-06-27T09:15:00.000Z",
      closedAt: "2026-06-27T11:00:00.000Z",
      consultations: [{ reason: "Fièvre", createdAt: "2026-06-27T09:40:00.000Z" }],
      invoices: [
        {
          invoiceNumber: "HRB-DEMO-F-2026-000001",
          createdAt: "2026-06-27T10:00:00.000Z",
          payments: [{ receiptNumber: "HRB-DEMO-R-2026-000001", paidAt: "2026-06-27T10:05:00.000Z" }],
        },
      ],
    },
  ],
};

describe("unit: patient timeline composition", () => {
  it("includes every record type and orders newest-first", () => {
    const events = composeTimeline(input);
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      "encounter_closed",
      "payment_recorded",
      "invoice_created",
      "consultation_recorded",
      "encounter_opened",
      "patient_registered",
    ]);
  });

  it("carries the right references", () => {
    const events = composeTimeline(input);
    expect(events.find((e) => e.type === "payment_recorded")?.ref).toBe("HRB-DEMO-R-2026-000001");
    expect(events.find((e) => e.type === "encounter_opened")?.ref).toBe("HRB-DEMO-V-2026-000001");
    expect(events.find((e) => e.type === "patient_registered")?.ref).toBeNull();
  });

  it("omits a close event for a still-open encounter and unpaid invoices", () => {
    const open: TimelineInput = {
      createdAt: "2026-06-27T08:00:00.000Z",
      encounters: [
        {
          encounterNumber: "V1",
          status: "open",
          openedAt: "2026-06-27T09:00:00.000Z",
          closedAt: null,
          consultations: [],
          invoices: [{ invoiceNumber: "F1", createdAt: "2026-06-27T09:30:00.000Z", payments: [] }],
        },
      ],
    };
    const types = composeTimeline(open).map((e) => e.type);
    expect(types).not.toContain("encounter_closed");
    expect(types).not.toContain("payment_recorded");
    expect(types).toContain("invoice_created");
  });
});
