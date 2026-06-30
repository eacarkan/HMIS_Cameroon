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

export type FefoAllocation = { batchId: string; quantity: number };

/**
 * FEFO allocation (Phase 2D-4/2D-5): consume earliest-expiry batches first, taking up to
 * `available(batch)` from each, until `requested` is met or stock runs out. Pure. `available` is the
 * caller's notion of capacity (available-to-reserve for reservations; on-hand for dispensing).
 * Returns the per-batch allocations, the total allocated, and any shortfall (when stock is short).
 */
export function allocateFefo<
  T extends { id: string; expiryDate: Date | string; createdAt?: Date | string },
>(
  batches: readonly T[],
  requested: number,
  available: (b: T) => number,
): { allocations: FefoAllocation[]; allocated: number; shortfall: number } {
  const sorted = sortFefo(batches);
  let remaining = Math.max(0, Math.trunc(requested));
  const allocations: FefoAllocation[] = [];
  for (const b of sorted) {
    if (remaining <= 0) break;
    const avail = Math.max(0, Math.trunc(available(b)));
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    allocations.push({ batchId: b.id, quantity: take });
    remaining -= take;
  }
  return { allocations, allocated: Math.max(0, Math.trunc(requested)) - remaining, shortfall: remaining };
}

/**
 * The id of the batch FEFO would pick for a NEW hold of `quantity` (Phase 2D-6): the earliest-expiry,
 * not-expired batch that can still cover the quantity from its available-to-reserve. Returns null when
 * none qualifies. Used to know whether a chosen batch DEVIATES from FEFO (and thus needs an override).
 */
export function fefoBatchId<
  T extends {
    id: string;
    expiryDate: Date | string;
    createdAt?: Date | string;
    quantityOnHand: number;
    quantityReserved: number;
  },
>(batches: readonly T[], quantity: number, now: Date): string | null {
  const need = Math.max(1, Math.trunc(quantity));
  for (const b of sortFefo(batches)) {
    if (!isExpired(b.expiryDate, now) && availableToReserve(b) >= need) return b.id;
  }
  return null;
}

/**
 * Validate a Pharmacist-in-Charge FEFO override (Phase 2D-6): re-pointing a reservation of `quantity`
 * onto a deliberately chosen `target` batch. Pure. The target must be the SAME medication, NOT expired,
 * have enough available-to-reserve, and actually differ from the current batch; the reason is mandatory.
 * Expired-stock handling is a separate dual-validated flow (2D-7) — an override may never pick an
 * expired batch.
 */
export function validateFefoOverride(input: {
  currentBatchId: string;
  reason: string;
  quantity: number;
  target: {
    id: string;
    medicationId: string;
    expiryDate: Date | string;
    quantityOnHand: number;
    quantityReserved: number;
  };
  medicationId: string;
  now: Date;
}): { ok: boolean; error?: string } {
  if (!input.reason?.trim()) return { ok: false, error: "Le motif de la dérogation FEFO est obligatoire." };
  if (input.target.id === input.currentBatchId) {
    return { ok: false, error: "Le lot choisi est déjà le lot réservé." };
  }
  if (input.target.medicationId !== input.medicationId) {
    return { ok: false, error: "Le lot choisi ne correspond pas au médicament réservé." };
  }
  if (isExpired(input.target.expiryDate, input.now)) {
    return { ok: false, error: "Le lot choisi est périmé — délivrance interdite." };
  }
  if (availableToReserve(input.target) < Math.max(1, Math.trunc(input.quantity))) {
    return { ok: false, error: "Le lot choisi n'a pas assez de stock disponible pour cette quantité." };
  }
  return { ok: true };
}
