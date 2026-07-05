import { describe, expect, it } from "vitest";

import {
  AGING_BUCKETS,
  agingBucket,
  assertBankLineMatch,
  assertDepositSlipTransition,
  assertSameHospital,
  bankLineMatchStatusFor,
  canMatchBankLine,
  canTransitionDepositSlip,
  DEPOSIT_SLIP_TRANSITIONS,
  depositSlipReconciles,
  depositSlipVarianceFcfa,
  isSameHospital,
  remainingUnmatchedFcfa,
} from "@/lib/finance";
import { formatDocumentNumber } from "@/lib/numbering";

/**
 * Phase 6.6 · Unit 1 — the deposit / bank-reconciliation domain rules, encoded PURELY (no DB) so the
 * Unit-4 services, the synthetic seed, and the DB constraints all agree. These pin the mentor's
 * validation requirements (Step-0 §9): status transitions, cleared-only-when-reconciled, no over-match,
 * cross-hospital rejection, and the deposit-slip / revenue-statement numbering format.
 */
describe("unit: 6.6 deposit-slip state machine", () => {
  it("allows the normal forward path prepared → deposited → cleared (only when reconciled)", () => {
    expect(canTransitionDepositSlip({ from: "prepared", to: "deposited", reconciles: false })).toBe(true);
    expect(canTransitionDepositSlip({ from: "deposited", to: "cleared", reconciles: true })).toBe(true);
  });

  it("rejects clearing over an open variance — cleared requires reconciliation", () => {
    expect(canTransitionDepositSlip({ from: "deposited", to: "cleared", reconciles: false })).toBe(false);
    expect(() =>
      assertDepositSlipTransition({ from: "deposited", to: "cleared", reconciles: false }),
    ).toThrow(/écart/i);
  });

  it("rejects forward skips (prepared → cleared) and same-state transitions", () => {
    expect(canTransitionDepositSlip({ from: "prepared", to: "cleared", reconciles: true })).toBe(false);
    expect(canTransitionDepositSlip({ from: "prepared", to: "prepared", reconciles: true })).toBe(false);
  });

  it("allows disputed as an exception path from any live state; disputed is terminal", () => {
    for (const from of ["prepared", "deposited", "cleared"] as const) {
      expect(canTransitionDepositSlip({ from, to: "disputed", reconciles: false })).toBe(true);
    }
    expect(DEPOSIT_SLIP_TRANSITIONS.disputed).toEqual([]);
    expect(canTransitionDepositSlip({ from: "disputed", to: "prepared", reconciles: true })).toBe(false);
  });

  it("forbids un-clearing except via disputed", () => {
    expect(canTransitionDepositSlip({ from: "cleared", to: "deposited", reconciles: true })).toBe(false);
    expect(canTransitionDepositSlip({ from: "cleared", to: "disputed", reconciles: false })).toBe(true);
  });
});

describe("unit: 6.6 amount rules (integer FCFA)", () => {
  it("variance = declared − computed (may be negative)", () => {
    expect(depositSlipVarianceFcfa(10000, 10000)).toBe(0);
    expect(depositSlipVarianceFcfa(11000, 10000)).toBe(1000);
    expect(depositSlipVarianceFcfa(9000, 10000)).toBe(-1000);
  });

  it("reconciles only when cleared == declared (zero tolerance)", () => {
    expect(depositSlipReconciles(10000, 10000)).toBe(true);
    expect(depositSlipReconciles(10000, 9999)).toBe(false);
    expect(depositSlipReconciles(10000, 10001)).toBe(false);
  });

  it("rejects over-matching a bank line and non-positive matches; allows an exact fill", () => {
    expect(canMatchBankLine({ lineAmountFcfa: 10000, alreadyMatchedFcfa: 0, newMatchAmountFcfa: 10000 })).toBe(true);
    expect(canMatchBankLine({ lineAmountFcfa: 10000, alreadyMatchedFcfa: 6000, newMatchAmountFcfa: 4000 })).toBe(true);
    expect(canMatchBankLine({ lineAmountFcfa: 10000, alreadyMatchedFcfa: 6000, newMatchAmountFcfa: 4001 })).toBe(false);
    expect(canMatchBankLine({ lineAmountFcfa: 10000, alreadyMatchedFcfa: 0, newMatchAmountFcfa: 0 })).toBe(false);
    expect(canMatchBankLine({ lineAmountFcfa: 10000, alreadyMatchedFcfa: 0, newMatchAmountFcfa: -5 })).toBe(false);
    expect(() =>
      assertBankLineMatch({ lineAmountFcfa: 100, alreadyMatchedFcfa: 100, newMatchAmountFcfa: 1 }),
    ).toThrow(/surrapprochement|invalide/i);
    expect(remainingUnmatchedFcfa(10000, 6000)).toBe(4000);
  });

  it("derives bank-line match status from consumed capacity", () => {
    expect(bankLineMatchStatusFor(10000, 0)).toBe("unmatched");
    expect(bankLineMatchStatusFor(10000, 9999)).toBe("unmatched");
    expect(bankLineMatchStatusFor(10000, 10000)).toBe("matched");
    expect(bankLineMatchStatusFor(0, 0)).toBe("unmatched");
  });
});

describe("unit: 6.6 cross-hospital guard", () => {
  it("passes only when all present hospital ids are identical", () => {
    expect(isSameHospital("h1", "h1", "h1")).toBe(true);
    expect(isSameHospital("h1", "h2")).toBe(false);
    expect(isSameHospital(null, undefined)).toBe(false);
    expect(() => assertSameHospital("h1", "h2")).toThrow(/inter-hôpitaux|refusé/i);
  });
});

describe("unit: 6.6 numbering (bordereau de versement + état des recettes)", () => {
  it("formats deposit-slip (BV) and revenue-statement (ETAT) numbers", () => {
    expect(
      formatDocumentNumber({ hospitalCode: "HRB-DEMO", kind: "deposit_slip", year: 2026, counter: 1 }),
    ).toBe("HRB-DEMO-BV-2026-000001");
    expect(
      formatDocumentNumber({ hospitalCode: "HRB-DEMO", kind: "revenue_statement", year: 2026, counter: 42 }),
    ).toBe("HRB-DEMO-ETAT-2026-000042");
  });
});

describe("unit: 6.6 receivables aging buckets", () => {
  it("classifies ages into 0-30 / 31-60 / 61-90 / 90+ (inclusive upper bounds)", () => {
    expect(AGING_BUCKETS).toEqual(["0-30", "31-60", "61-90", "90+"]);
    expect(agingBucket(0)).toBe("0-30");
    expect(agingBucket(30)).toBe("0-30");
    expect(agingBucket(31)).toBe("31-60");
    expect(agingBucket(60)).toBe("31-60");
    expect(agingBucket(61)).toBe("61-90");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(91)).toBe("90+");
    expect(agingBucket(365)).toBe("90+");
    // A negative age (future createdAt — shouldn't happen) falls into the youngest bucket, never crashes.
    expect(agingBucket(-5)).toBe("0-30");
  });
});
