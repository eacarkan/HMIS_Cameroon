/**
 * Medication stock rules (pure, client-safe) — Phase 2D-3+.
 *
 * Batch validation, FEFO ordering and availability math over the batch ledger. Integer quantities.
 * No data access. Reservations (2D-4) hold `quantityReserved`; dispensing (2D-5) deducts
 * `quantityOnHand`; FEFO (2D-6) consumes earliest-expiry first.
 */

export type StockBatchInput = {
  medicationId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
};

export function validateStockBatchInput(input: StockBatchInput): { ok: boolean; error?: string } {
  if (!input.medicationId?.trim()) return { ok: false, error: "Le médicament est obligatoire." };
  if (!input.batchNumber?.trim()) return { ok: false, error: "Le numéro de lot est obligatoire." };
  const d = new Date(input.expiryDate);
  if (!input.expiryDate || Number.isNaN(d.getTime())) {
    return { ok: false, error: "La date de péremption est invalide." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "La quantité doit être un entier positif." };
  }
  return { ok: true };
}

/** Units that can still be reserved from a batch (never negative). */
export function availableToReserve(batch: {
  quantityOnHand: number;
  quantityReserved: number;
}): number {
  return Math.max(0, batch.quantityOnHand - batch.quantityReserved);
}

/** FEFO order: earliest expiry first; ties broken by createdAt then id for determinism. */
export function sortFefo<
  T extends { expiryDate: Date | string; createdAt?: Date | string; id?: string },
>(batches: readonly T[]): T[] {
  return [...batches].sort((a, b) => {
    const ea = new Date(a.expiryDate).getTime();
    const eb = new Date(b.expiryDate).getTime();
    if (ea !== eb) return ea - eb;
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ca !== cb) return ca - cb;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

export function totalOnHand(batches: readonly { quantityOnHand: number }[]): number {
  return batches.reduce((s, b) => s + b.quantityOnHand, 0);
}

export function totalReserved(batches: readonly { quantityReserved: number }[]): number {
  return batches.reduce((s, b) => s + b.quantityReserved, 0);
}

/** A batch is expired when its expiry date is on or before `now` (date-level). */
export function isExpired(expiryDate: Date | string, now: Date): boolean {
  return new Date(expiryDate).getTime() <= now.getTime();
}
