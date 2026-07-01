/**
 * Emergency-exception rules (pure, client-safe) — Phase 2H.
 *
 * Emergency Debt accrual / settlement / waiver invariants. No data access; integer FCFA. The ledger is
 * append-and-transition only: an entry can move from `outstanding` to `settled` or `waived`, never the
 * other way, and is never deleted — so emergency debt can never silently disappear.
 */

export type EmergencyDebtStatusValue = "outstanding" | "settled" | "waived";

export function validateEmergencyDebtInput(input: {
  amount: number;
  source: string;
}): { ok: boolean; error?: string } {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Le montant doit être un entier positif (FCFA)." };
  }
  if (!input.source?.trim()) {
    return { ok: false, error: "L'objet de la dette d'urgence est obligatoire." };
  }
  return { ok: true };
}

/** Only an OUTSTANDING entry can be settled or waived. */
export function canDecideEmergencyDebt(status: string): boolean {
  return status === "outstanding";
}

/** Total still owed (sum of outstanding entry amounts). Integer FCFA. */
export function sumOutstandingEmergencyDebt(
  debts: readonly { amount: number; status: string }[],
): number {
  return debts
    .filter((d) => d.status === "outstanding")
    .reduce((sum, d) => sum + Math.max(0, Math.trunc(d.amount)), 0);
}

/** True if any entry is still outstanding — the discharge gate (2G). */
export function hasOutstandingEmergencyDebt(
  debts: readonly { status: string }[],
): boolean {
  return debts.some((d) => d.status === "outstanding");
}
