import { describe, expect, it } from "vitest";

import {
  DIAGNOSTIC_STATUSES,
  canStartDiagnostic,
  canTransitionDiagnostic,
  isResultVisible,
  isResultVisibleToDoctor,
  isTerminalDiagnosticStatus,
  validateDiagnosticCatalogueInput,
  validateResultText,
} from "@/lib/diagnostics";

describe("lib/diagnostics — order state machine", () => {
  it("exposes the six statuses", () => {
    expect(DIAGNOSTIC_STATUSES).toEqual([
      "requested",
      "payment_confirmed",
      "in_progress",
      "result_entered",
      "validated",
      "cancelled",
    ]);
  });

  it("allows the intended forward transitions, including the emergency bypass to in_progress", () => {
    expect(canTransitionDiagnostic("requested", "payment_confirmed")).toBe(true);
    expect(canTransitionDiagnostic("requested", "in_progress")).toBe(true); // emergency bypass
    expect(canTransitionDiagnostic("payment_confirmed", "in_progress")).toBe(true);
    expect(canTransitionDiagnostic("in_progress", "result_entered")).toBe(true);
    expect(canTransitionDiagnostic("result_entered", "validated")).toBe(true);
  });

  it("rejects skipping or reversing", () => {
    expect(canTransitionDiagnostic("requested", "validated")).toBe(false);
    expect(canTransitionDiagnostic("in_progress", "validated")).toBe(false);
    expect(canTransitionDiagnostic("validated", "result_entered")).toBe(false);
    expect(canTransitionDiagnostic("cancelled", "requested")).toBe(false);
  });

  it("marks validated + cancelled terminal", () => {
    expect(isTerminalDiagnosticStatus("validated")).toBe(true);
    expect(isTerminalDiagnosticStatus("cancelled")).toBe(true);
    expect(isTerminalDiagnosticStatus("in_progress")).toBe(false);
  });
});

describe("lib/diagnostics — THE visibility rule (doctor sees results only after validation)", () => {
  it("hides the result from the doctor (non-staff) until validated", () => {
    expect(isResultVisibleToDoctor("requested")).toBe(false);
    expect(isResultVisibleToDoctor("in_progress")).toBe(false);
    expect(isResultVisibleToDoctor("result_entered")).toBe(false); // entered but NOT yet validated
    expect(isResultVisibleToDoctor("validated")).toBe(true);
  });

  it("lets staff see the result once it is in progress / entered (to enter + validate it)", () => {
    expect(isResultVisible("in_progress", true)).toBe(true);
    expect(isResultVisible("result_entered", true)).toBe(true);
    expect(isResultVisible("requested", true)).toBe(false); // nothing to see yet
    // Everyone sees a validated result.
    expect(isResultVisible("validated", false)).toBe(true);
  });
});

describe("lib/diagnostics — payment / emergency gate to start", () => {
  it("starts a paid order, or an unpaid one only when the encounter is an emergency", () => {
    expect(canStartDiagnostic({ status: "payment_confirmed", isPaid: true, isEmergency: false })).toBe(true);
    expect(canStartDiagnostic({ status: "requested", isPaid: true, isEmergency: false })).toBe(true);
    expect(canStartDiagnostic({ status: "requested", isPaid: false, isEmergency: true })).toBe(true); // bypass
    expect(canStartDiagnostic({ status: "requested", isPaid: false, isEmergency: false })).toBe(false);
    expect(canStartDiagnostic({ status: "in_progress", isPaid: true, isEmergency: false })).toBe(false);
  });
});

describe("lib/diagnostics — validators", () => {
  it("requires non-empty result text", () => {
    expect(validateResultText("Hb 12 g/dL").ok).toBe(true);
    expect(validateResultText("   ").ok).toBe(false);
    expect(validateResultText(null).ok).toBe(false);
  });

  it("validates a catalogue entry (code, name, modality, non-negative price)", () => {
    expect(validateDiagnosticCatalogueInput({ code: "LAB-NFS", nameFr: "NFS", modality: "lab", price: 3500 }).ok).toBe(true);
    expect(validateDiagnosticCatalogueInput({ code: "", nameFr: "NFS", modality: "lab", price: 100 }).ok).toBe(false);
    expect(validateDiagnosticCatalogueInput({ code: "X", nameFr: "NFS", modality: "scanner", price: 100 }).ok).toBe(false);
    expect(validateDiagnosticCatalogueInput({ code: "X", nameFr: "NFS", modality: "lab", price: -1 }).ok).toBe(false);
  });
});
