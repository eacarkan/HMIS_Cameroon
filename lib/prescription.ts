/**
 * Prescription state machine + line validation (pure, client-safe) — Phase 2D-2.
 *
 * Lifecycle: draft → finalized → sent_to_pharmacy → partially_dispensed → dispensed (+ cancelled
 * from any non-terminal state). 2D-2 drives draft → finalized → sent_to_pharmacy; the dispensing
 * transitions (partially_dispensed / dispensed) are applied by the dispensing flow (2D-5). No data
 * access; integer quantities.
 */

export type PrescriptionStatus =
  | "draft"
  | "finalized"
  | "sent_to_pharmacy"
  | "partially_dispensed"
  | "dispensed"
  | "cancelled";

const TRANSITIONS: Record<PrescriptionStatus, readonly PrescriptionStatus[]> = {
  draft: ["finalized", "cancelled"],
  finalized: ["sent_to_pharmacy", "cancelled"],
  sent_to_pharmacy: ["partially_dispensed", "dispensed", "cancelled"],
  partially_dispensed: ["partially_dispensed", "dispensed", "cancelled"],
  dispensed: [],
  cancelled: [],
};

export function isPrescriptionStatus(value: string): value is PrescriptionStatus {
  return value in TRANSITIONS;
}

export function canTransitionPrescription(from: string, to: string): boolean {
  if (!isPrescriptionStatus(from) || !isPrescriptionStatus(to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function isTerminalPrescription(status: string): boolean {
  return status === "dispensed" || status === "cancelled";
}

export type PrescriptionItemInput = {
  medicationId: string;
  dosage: string;
  frequency?: string | null;
  duration: string;
  quantity: number;
  instructions?: string | null;
};

/** A prescribed line needs a medication, dosage, duration and a positive integer quantity. */
export function validatePrescriptionItem(item: PrescriptionItemInput): {
  ok: boolean;
  error?: string;
} {
  if (!item.medicationId?.trim()) return { ok: false, error: "Le médicament est obligatoire." };
  if (!item.dosage?.trim()) return { ok: false, error: "La posologie est obligatoire." };
  if (!item.duration?.trim()) return { ok: false, error: "La durée est obligatoire." };
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    return { ok: false, error: "La quantité doit être un entier positif." };
  }
  return { ok: true };
}
