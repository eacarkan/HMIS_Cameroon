/**
 * Phase 6.6 — deposit / bank-reconciliation domain rules (PURE; no DB, no money mutation).
 *
 * These are the invariants the later finance SERVICES (Unit 4) enforce. Encoding them here — DB-free
 * and unit-tested — means the service layer, the synthetic seed, and the tests all agree on ONE set of
 * rules. NOTHING here reads or writes Invoice/Payment: reconciliation is metadata-only (Step-0 §6/§9).
 * Integer FCFA throughout (05 §9) — callers pass whole-FCFA integers.
 */

import type { BankLineMatchStatus, DepositSlipStatus } from "@prisma/client";

// ---------------------------------------------------------------------------------------------------
// Deposit-slip state machine (Step-0 §9): prepared → deposited → cleared, with `disputed` as the
// exception path from any live state. No forward skips; a slip clears ONLY when it reconciles.
// ---------------------------------------------------------------------------------------------------

/** Allowed next states per current state. `disputed` is terminal (re-opening is a new slip). */
export const DEPOSIT_SLIP_TRANSITIONS: Record<
  DepositSlipStatus,
  readonly DepositSlipStatus[]
> = {
  prepared: ["deposited", "disputed"],
  deposited: ["cleared", "disputed"],
  cleared: ["disputed"],
  disputed: [],
};

export type DepositSlipTransitionInput = {
  from: DepositSlipStatus;
  to: DepositSlipStatus;
  /** Whether cleared == declared (zero tolerance). Only consulted for a `→ cleared` transition. */
  reconciles: boolean;
};

/**
 * May a slip move `from → to`? `prepared → deposited → cleared` is the only forward path; any of
 * {prepared, deposited, cleared} may drop to `disputed`; a slip may become `cleared` ONLY when its
 * cleared amount reconciles with the declared total. No skips (prepared → cleared is invalid), and no
 * un-clearing except via `disputed`.
 */
export function canTransitionDepositSlip({
  from,
  to,
  reconciles,
}: DepositSlipTransitionInput): boolean {
  if (from === to) return false;
  if (!DEPOSIT_SLIP_TRANSITIONS[from].includes(to)) return false;
  if (to === "cleared" && !reconciles) return false;
  return true;
}

/** Throwing form for the service layer. */
export function assertDepositSlipTransition(input: DepositSlipTransitionInput): void {
  if (!canTransitionDepositSlip(input)) {
    const clearedGap = input.to === "cleared" && !input.reconciles;
    throw new Error(
      `Transition de bordereau invalide : ${input.from} → ${input.to}` +
        (clearedGap ? " (écart non réconcilié : le montant compensé doit égaler le montant déclaré)." : "."),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Amount rules (all integer FCFA).
// ---------------------------------------------------------------------------------------------------

/** declared − computed (system-vs-declared). Positive = declared exceeds the linked payments total. */
export function depositSlipVarianceFcfa(
  declaredTotalFcfa: number,
  computedPaymentTotalFcfa: number,
): number {
  return declaredTotalFcfa - computedPaymentTotalFcfa;
}

/**
 * A slip reconciles (and may be cleared) when what the bank cleared equals what was declared. Zero
 * tolerance per Step-0 §9 ("cleared == declared, or the mentor-agreed tolerance == 0").
 */
export function depositSlipReconciles(
  declaredTotalFcfa: number,
  clearedAmountFcfa: number,
): boolean {
  return clearedAmountFcfa === declaredTotalFcfa;
}

/** Remaining capacity on a bank line = amount − already-matched (never negative in a valid state). */
export function remainingUnmatchedFcfa(
  lineAmountFcfa: number,
  alreadyMatchedFcfa: number,
): number {
  return lineAmountFcfa - alreadyMatchedFcfa;
}

export type BankLineMatchInput = {
  lineAmountFcfa: number;
  alreadyMatchedFcfa: number;
  newMatchAmountFcfa: number;
};

/**
 * May a new match of `newMatchAmountFcfa` be written against a bank line? Rejects a non-positive
 * amount and any OVER-match (Σ already-matched + new > line amount). Exactly filling the line is
 * allowed (Step-0 §9 "no over-matching a bank line").
 */
export function canMatchBankLine({
  lineAmountFcfa,
  alreadyMatchedFcfa,
  newMatchAmountFcfa,
}: BankLineMatchInput): boolean {
  if (!Number.isInteger(newMatchAmountFcfa) || newMatchAmountFcfa <= 0) return false;
  if (alreadyMatchedFcfa < 0) return false;
  return alreadyMatchedFcfa + newMatchAmountFcfa <= lineAmountFcfa;
}

/** Throwing form for the service layer. */
export function assertBankLineMatch(input: BankLineMatchInput): void {
  if (!canMatchBankLine(input)) {
    throw new Error(
      "Rapprochement invalide : montant non positif ou surrapprochement de la ligne bancaire.",
    );
  }
}

/** Derived bank-line status from consumed capacity: `matched` once fully consumed, else `unmatched`. */
export function bankLineMatchStatusFor(
  lineAmountFcfa: number,
  matchedFcfa: number,
): Extract<BankLineMatchStatus, "unmatched" | "matched"> {
  return lineAmountFcfa > 0 && matchedFcfa >= lineAmountFcfa ? "matched" : "unmatched";
}

// ---------------------------------------------------------------------------------------------------
// Cross-hospital guard (Step-0 §9): every id involved in a link/match must share ONE hospital.
// ---------------------------------------------------------------------------------------------------

/** True iff at least one hospitalId is present and all present ids are identical. */
export function isSameHospital(
  ...hospitalIds: (string | null | undefined)[]
): boolean {
  const present = hospitalIds.filter((h): h is string => !!h);
  return present.length > 0 && present.every((h) => h === present[0]);
}

/** Throwing form for the service layer. */
export function assertSameHospital(
  ...hospitalIds: (string | null | undefined)[]
): void {
  if (!isSameHospital(...hospitalIds)) {
    throw new Error(
      "Rapprochement inter-hôpitaux refusé : les enregistrements doivent partager le même hôpital.",
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Receivables aging (Step-0 §5): buckets 0–30 / 31–60 / 61–90 / 90+ days, anchored on the item's
// createdAt. Pure classifier so the service, the seed and the tests bucket identically.
// ---------------------------------------------------------------------------------------------------

export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Classify an age in whole days into a receivables-aging bucket (negatives fall into 0–30). */
export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
