import { describe, expect, it } from "vitest";

import {
  ADMISSION_STATUSES,
  canTransitionAdmission,
  computeDischargeBlock,
  dailyChargeDate,
  dailyChargeDateKey,
  isActiveAdmissionStatus,
  isAdmissionStatus,
  isTerminalAdmissionStatus,
  validateAdmissionRequest,
  validateDailyWardFee,
} from "@/lib/hospitalization";

describe("lib/hospitalization — admission state machine", () => {
  it("exposes the five statuses and recognises them", () => {
    expect(ADMISSION_STATUSES).toEqual([
      "requested",
      "admitted",
      "discharge_requested",
      "discharged",
      "cancelled",
    ]);
    expect(isAdmissionStatus("admitted")).toBe(true);
    expect(isAdmissionStatus("nope")).toBe(false);
  });

  it("allows only the intended forward transitions", () => {
    expect(canTransitionAdmission("requested", "admitted")).toBe(true);
    expect(canTransitionAdmission("requested", "cancelled")).toBe(true);
    expect(canTransitionAdmission("admitted", "discharge_requested")).toBe(true);
    expect(canTransitionAdmission("admitted", "discharged")).toBe(true);
    expect(canTransitionAdmission("discharge_requested", "discharged")).toBe(true);
  });

  it("rejects illegal transitions (no cancel after admit, no resurrection of terminal states)", () => {
    expect(canTransitionAdmission("admitted", "cancelled")).toBe(false);
    expect(canTransitionAdmission("requested", "discharged")).toBe(false);
    expect(canTransitionAdmission("discharged", "admitted")).toBe(false);
    expect(canTransitionAdmission("cancelled", "admitted")).toBe(false);
  });

  it("classifies terminal vs active statuses", () => {
    expect(isTerminalAdmissionStatus("discharged")).toBe(true);
    expect(isTerminalAdmissionStatus("cancelled")).toBe(true);
    expect(isTerminalAdmissionStatus("admitted")).toBe(false);
    expect(isActiveAdmissionStatus("requested")).toBe(true);
    expect(isActiveAdmissionStatus("discharge_requested")).toBe(true);
    expect(isActiveAdmissionStatus("discharged")).toBe(false);
  });
});

describe("lib/hospitalization — validation", () => {
  it("requires an admission reason", () => {
    expect(validateAdmissionRequest({ reason: "Paludisme grave" }).ok).toBe(true);
    expect(validateAdmissionRequest({ reason: "  " }).ok).toBe(false);
    expect(validateAdmissionRequest({ reason: null }).ok).toBe(false);
  });

  it("requires a strictly-positive integer daily ward fee", () => {
    expect(validateDailyWardFee(10000).ok).toBe(true);
    expect(validateDailyWardFee(0).ok).toBe(false);
    expect(validateDailyWardFee(-5).ok).toBe(false);
    expect(validateDailyWardFee(1500.5).ok).toBe(false);
  });
});

describe("lib/hospitalization — discharge gate", () => {
  it("is clear when nothing is owed", () => {
    expect(computeDischargeBlock({ unpaidInvoiceCount: 0, outstandingEmergencyDebt: 0 })).toEqual({
      blocked: false,
      reasons: [],
    });
  });

  it("blocks on unpaid invoices, with a count-aware reason", () => {
    expect(computeDischargeBlock({ unpaidInvoiceCount: 1, outstandingEmergencyDebt: 0 })).toEqual({
      blocked: true,
      reasons: ["1 facture non réglée"],
    });
    const many = computeDischargeBlock({ unpaidInvoiceCount: 3, outstandingEmergencyDebt: 0 });
    expect(many.blocked).toBe(true);
    expect(many.reasons[0]).toBe("3 factures non réglées");
  });

  it("blocks on outstanding emergency debt (2H linkage), and combines both reasons", () => {
    const both = computeDischargeBlock({ unpaidInvoiceCount: 2, outstandingEmergencyDebt: 5000 });
    expect(both.blocked).toBe(true);
    expect(both.reasons).toContain("dette d'urgence en cours");
    expect(both.reasons.length).toBe(2);
  });
});

describe("lib/hospitalization — daily charge idempotency key", () => {
  it("collapses any time on a day to that UTC calendar date", () => {
    expect(dailyChargeDateKey(new Date("2026-06-30T01:23:45.000Z"))).toBe("2026-06-30");
    expect(dailyChargeDateKey(new Date("2026-06-30T23:59:59.000Z"))).toBe("2026-06-30");
  });

  it("normalises to UTC midnight for the @db.Date column", () => {
    expect(dailyChargeDate(new Date("2026-06-30T14:00:00.000Z")).toISOString()).toBe(
      "2026-06-30T00:00:00.000Z",
    );
  });
});
