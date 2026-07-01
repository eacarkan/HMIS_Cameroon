/**
 * Money — integer FCFA (D-009, 09 §8).
 *
 * RULE: money is ALWAYS stored and computed as integers (whole francs CFA). There
 * is no decimal subunit in practice for XAF, and floats are never used for money,
 * anywhere. Formatting lives here and nowhere else, so "15 000 FCFA" is identical
 * across the UI, the dashboard and the printed receipt.
 */

/** A monetary amount in whole francs CFA. Always an integer. */
export type Fcfa = number;

/** French decimal grouping, no fraction digits (e.g. 15000 → "15 000"). */
const FR_GROUPING = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** No-break space (U+00A0) joining the amount to its unit so it never wraps. */
const NBSP = "\u00A0";

/** True when `value` is a finite, safe integer usable as an FCFA amount. */
export function isFcfa(value: number): value is Fcfa {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

/** Throw unless `value` is a valid integer FCFA amount. */
export function assertFcfa(value: number): asserts value is Fcfa {
  if (!isFcfa(value)) {
    throw new Error(`Invalid FCFA amount (must be an integer): ${value}`);
  }
}

/**
 * Format an integer amount as French FCFA, e.g. `formatFcfa(15000) → "15 000 FCFA"`.
 * Grouping uses the French narrow no-break space; a no-break space joins the amount
 * to the unit so "15 000 FCFA" never wraps.
 */
export function formatFcfa(amount: Fcfa): string {
  assertFcfa(amount);
  return `${FR_GROUPING.format(amount)}${NBSP}FCFA`;
}

/** Sum integer amounts, keeping the result an integer (e.g. invoice total). */
export function sumFcfa(amounts: readonly Fcfa[]): Fcfa {
  return amounts.reduce((total, amount) => {
    assertFcfa(amount);
    return total + amount;
  }, 0);
}

/** Line total = unit price × quantity, integer-safe (e.g. 2 000 × 1). */
export function lineTotalFcfa(unitPrice: Fcfa, quantity: number): Fcfa {
  assertFcfa(unitPrice);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(
      `Invalid quantity (must be a non-negative integer): ${quantity}`,
    );
  }
  return unitPrice * quantity;
}
