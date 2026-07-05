import type { PrismaClient } from "@prisma/client";

import {
  bankLineMatchStatusFor,
  depositSlipVarianceFcfa,
} from "@/lib/finance";
import { formatDocumentNumber } from "@/lib/numbering";

/**
 * Phase 6.6 · Unit 1 — synthetic FINANCE overlay seed (additive; metadata-only; sentinel-idempotent).
 *
 * Enriches an already-seeded demo hospital with the reconciliation caseload the later finance units
 * (MoMo report, aging, deposit/bank reconciliation) demonstrate:
 *   - Mobile-Money operator/reference SNAPSHOTS backfilled onto existing `mobile_money` payments
 *     (NULLABLE metadata columns — never `amount`/`status`/`receiptNumber`);
 *   - deposit slips (bordereaux de versement) grouping recorded cash/transfer payments, one per lifecycle
 *     state (prepared / deposited / cleared / disputed), with the amount snapshots computed from the
 *     LINKED payments (read-only Σ) — the overlay NEVER writes an Invoice/Payment money field;
 *   - a SYNTHETIC bank statement (isMock) with a clean match, an awaiting-reconciliation line, a
 *     deliberate mismatch, and an orphan credit — so the reconciliation screen has real gaps to surface.
 *
 * Determinism: payments are consumed in a stable order (paidAt, then receiptNumber); slip numbers come
 * from the per-hospital Sequence; amounts/statuses are a pure function of the base data. Re-running is a
 * no-op after the sentinel is written (or a top-up with `force: true`, TEST only). This function does NOT
 * create patients/invoices/payments and never calls a mutating billing path — it is pure overlay.
 */

export const FINANCE_SENTINEL_KEY = "demo.seed.phase66finance";
const FINANCE_SENTINEL_VALUE = "v1";

/** How many recorded payments each slip groups, and how many slips at most (one per lifecycle state). */
const SLIP_SIZE = 5;
const MAX_SLIPS = 4;
/** Deliberate declared-vs-computed gap (FCFA) injected on the `disputed` slip so a variance is visible. */
const DISPUTED_VARIANCE_FCFA = 1000;
/** Deliberate bank-vs-declared gap (FCFA) on the mismatching bank line. */
const MISMATCH_FCFA = 500;

export type SeedFinanceResult = {
  skipped: boolean;
  momoBackfilled: number;
  slips: number;
  slipPayments: number;
  bankLines: number;
  matches: number;
};

const SLIP_STATES = ["prepared", "deposited", "cleared", "disputed"] as const;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function seedDemoFinance(
  prisma: PrismaClient,
  opts: { hospitalId: string; hospitalCode: string; force?: boolean },
): Promise<SeedFinanceResult> {
  const { hospitalId, hospitalCode, force = false } = opts;
  const year = new Date().getFullYear();
  const result: SeedFinanceResult = {
    skipped: false, momoBackfilled: 0, slips: 0, slipPayments: 0, bankLines: 0, matches: 0,
  };

  const sentinel = await prisma.setting
    .findUnique({ where: { hospitalId_key: { hospitalId, key: FINANCE_SENTINEL_KEY } } })
    .catch(() => null);
  if (sentinel && !force) return { ...result, skipped: true };

  // Deterministic per-hospital slip number from the Sequence counter (no service ctx needed here).
  async function nextSlipNumber(): Promise<string> {
    const seq = await prisma.sequence.upsert({
      where: { hospitalId_type_year: { hospitalId, type: "deposit_slip", year } },
      create: { hospitalId, type: "deposit_slip", year, current: 1 },
      update: { current: { increment: 1 } },
    });
    return formatDocumentNumber({ hospitalCode, kind: "deposit_slip", year, counter: seq.current });
  }

  // ---- 1) Mobile-Money snapshot backfill (metadata only; alternate MTN / ORANGE deterministically) ----
  const momoPayments = await prisma.payment.findMany({
    where: {
      hospitalId, method: "mobile_money", status: "recorded", deletedAt: null,
      mobileMoneyOperator: null,
    },
    orderBy: [{ paidAt: "asc" }, { receiptNumber: "asc" }],
    select: { id: true },
  });
  for (let i = 0; i < momoPayments.length; i++) {
    const operator = i % 2 === 0 ? "MTN" : "ORANGE";
    await prisma.payment.update({
      where: { id: momoPayments[i].id },
      data: {
        mobileMoneyOperator: operator,
        mobileMoneyReference: `MM-${operator}-${String(i + 1).padStart(6, "0")}`,
      },
    });
    result.momoBackfilled++;
  }

  // ---- 2) Deposit slips over recorded cash/transfer payments not already on a slip ----
  const alreadyLinked = new Set(
    (await prisma.depositSlipPayment.findMany({
      where: { hospitalId, deletedAt: null }, select: { paymentId: true },
    })).map((r) => r.paymentId),
  );
  const pool = (
    await prisma.payment.findMany({
      where: {
        hospitalId, status: "recorded", deletedAt: null,
        method: { in: ["cash", "bank_transfer"] },
      },
      orderBy: [{ paidAt: "asc" }, { receiptNumber: "asc" }],
      select: { id: true, amount: true },
    })
  ).filter((p) => !alreadyLinked.has(p.id));

  const groups = chunk(pool, SLIP_SIZE).slice(0, MAX_SLIPS).filter((g) => g.length > 0);
  const clearedSlipInfo: { declared: number; depositDate: Date }[] = [];
  const depositedSlipInfo: { declared: number; depositDate: Date }[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const status = SLIP_STATES[i];
    const computed = group.reduce((s, p) => s + p.amount, 0);
    const declared = status === "disputed" ? computed + DISPUTED_VARIANCE_FCFA : computed;
    const cleared = status === "cleared" ? declared : 0;
    const depositDate = daysAgo(2 + i * 3);

    const slip = await prisma.depositSlip.create({
      data: {
        hospitalId,
        slipNumber: await nextSlipNumber(),
        depositDate,
        status,
        declaredTotalFcfa: declared,
        computedPaymentTotalFcfa: computed,
        clearedAmountFcfa: cleared,
        varianceFcfa: depositSlipVarianceFcfa(declared, computed),
        note:
          status === "disputed"
            ? "Écart déclaré/système — en litige (données synthétiques)."
            : status === "cleared"
              ? "Rapproché avec le relevé bancaire synthétique."
              : null,
      },
    });
    result.slips++;

    for (const p of group) {
      await prisma.depositSlipPayment.create({
        data: { hospitalId, depositSlipId: slip.id, paymentId: p.id },
      });
      result.slipPayments++;
    }

    if (status === "cleared") clearedSlipInfo.push({ declared, depositDate });
    if (status === "deposited") depositedSlipInfo.push({ declared, depositDate });
  }

  // ---- 3) Synthetic bank statement lines (isMock) + one clean reconciliation match ----
  // Deterministic (a stable (depositDate, slipNumber) order — no ties) AND idempotent (the whole block is
  // skipped when this import batch already exists, so a `--test --force` top-up never duplicates lines).
  const importBatchId = `BANK-${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-B1`;
  const slipsForLines = await prisma.depositSlip.findMany({
    where: { hospitalId }, orderBy: [{ depositDate: "asc" }, { slipNumber: "asc" }],
  });

  async function addBankLine(amount: number, label: string, matched: number, reference: string): Promise<string> {
    const line = await prisma.bankStatementLine.create({
      data: {
        hospitalId,
        valueDate: daysAgo(1),
        amountFcfa: amount,
        label,
        reference,
        importBatchId,
        isMock: true,
        matchStatus: bankLineMatchStatusFor(amount, matched),
      },
    });
    result.bankLines++;
    return line.id;
  }

  const bankBatchExists = (await prisma.bankStatementLine.count({ where: { hospitalId, importBatchId } })) > 0;
  if (!bankBatchExists) {
    // (a) clean match against the `cleared` slip (bank == declared → matched + a reconciliation row).
    const clearedSlip = slipsForLines.find((s) => s.status === "cleared");
    if (clearedSlip) {
      const lineId = await addBankLine(
        clearedSlip.declaredTotalFcfa, "Versement espèces guichet",
        clearedSlip.declaredTotalFcfa, `REL-${importBatchId}-001`,
      );
      await prisma.bankReconciliationMatch.create({
        data: {
          hospitalId, bankStatementLineId: lineId, depositSlipId: clearedSlip.id,
          matchedAmountFcfa: clearedSlip.declaredTotalFcfa,
          note: "Rapprochement automatique (montant exact) — données synthétiques.",
        },
      });
      result.matches++;
    }

    // (b) an awaiting-reconciliation line for the `deposited` slip (landed, not yet matched).
    const depositedSlip = slipsForLines.find((s) => s.status === "deposited");
    if (depositedSlip) {
      await addBankLine(
        depositedSlip.declaredTotalFcfa, "Versement en attente de rapprochement", 0,
        `REL-${importBatchId}-002`,
      );
    }

    // (c) a deliberate MISMATCH line (bank ≠ any declared total → a discrepancy to surface).
    if (slipsForLines.length > 0) {
      await addBankLine(
        Math.max(0, slipsForLines[0].declaredTotalFcfa - MISMATCH_FCFA),
        "Versement — écart de montant", 0, `REL-${importBatchId}-003`,
      );
    }

    // (d) an orphan bank credit with no corresponding slip (unmatched, awaiting investigation).
    await addBankLine(7500, "Virement entrant non identifié", 0, `REL-${importBatchId}-004`);
  }

  // Sentinel LAST — single-success idempotency (a completed run makes a re-run a no-op).
  await prisma.setting.upsert({
    where: { hospitalId_key: { hospitalId, key: FINANCE_SENTINEL_KEY } },
    create: { hospitalId, key: FINANCE_SENTINEL_KEY, value: FINANCE_SENTINEL_VALUE },
    update: { value: FINANCE_SENTINEL_VALUE, deletedAt: null },
  });

  return result;
}
