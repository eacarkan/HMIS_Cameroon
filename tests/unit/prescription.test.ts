import { describe, expect, it } from "vitest";

import {
  canTransitionPrescription,
  isTerminalPrescription,
  validatePrescriptionItem,
} from "@/lib/prescription";

const item = {
  medicationId: "med-1",
  dosage: "1 comprimé",
  frequency: "3x/jour",
  duration: "5 jours",
  quantity: 15,
  instructions: "après les repas",
};

describe("prescription state machine (Phase 2D-2)", () => {
  it("allows draft → finalized → sent_to_pharmacy", () => {
    expect(canTransitionPrescription("draft", "finalized")).toBe(true);
    expect(canTransitionPrescription("finalized", "sent_to_pharmacy")).toBe(true);
  });

  it("allows dispensing transitions only from sent/partially", () => {
    expect(canTransitionPrescription("sent_to_pharmacy", "partially_dispensed")).toBe(true);
    expect(canTransitionPrescription("sent_to_pharmacy", "dispensed")).toBe(true);
    expect(canTransitionPrescription("partially_dispensed", "dispensed")).toBe(true);
  });

  it("allows cancel from any non-terminal state", () => {
    for (const s of ["draft", "finalized", "sent_to_pharmacy", "partially_dispensed"]) {
      expect(canTransitionPrescription(s, "cancelled")).toBe(true);
    }
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransitionPrescription("draft", "sent_to_pharmacy")).toBe(false);
    expect(canTransitionPrescription("draft", "dispensed")).toBe(false);
    expect(canTransitionPrescription("dispensed", "cancelled")).toBe(false);
    expect(canTransitionPrescription("cancelled", "finalized")).toBe(false);
    expect(canTransitionPrescription("draft", "bogus")).toBe(false);
  });

  it("flags terminal statuses", () => {
    expect(isTerminalPrescription("dispensed")).toBe(true);
    expect(isTerminalPrescription("cancelled")).toBe(true);
    expect(isTerminalPrescription("draft")).toBe(false);
  });
});

describe("prescription item validation (Phase 2D-2)", () => {
  it("accepts a complete line", () => {
    expect(validatePrescriptionItem(item).ok).toBe(true);
  });

  it("requires medication, dosage, duration and a positive integer quantity", () => {
    expect(validatePrescriptionItem({ ...item, medicationId: "" }).ok).toBe(false);
    expect(validatePrescriptionItem({ ...item, dosage: " " }).ok).toBe(false);
    expect(validatePrescriptionItem({ ...item, duration: "" }).ok).toBe(false);
    expect(validatePrescriptionItem({ ...item, quantity: 0 }).ok).toBe(false);
    expect(validatePrescriptionItem({ ...item, quantity: -3 }).ok).toBe(false);
    expect(validatePrescriptionItem({ ...item, quantity: 1.5 }).ok).toBe(false);
  });

  it("frequency and instructions are optional", () => {
    expect(validatePrescriptionItem({ ...item, frequency: null, instructions: null }).ok).toBe(true);
  });
});
