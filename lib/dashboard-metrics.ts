/**
 * Dashboard metrics (pure, client-safe) — Phase 1A Batch 5.
 *
 * Decides which dashboard sections a role may see (capability-driven) and aggregates a day's
 * payments by mode. Read-only derivations over existing data — NO BI / data warehouse, NO
 * cross-hospital analytics. No data access.
 */
import { totalsByMethod, type MethodTotal } from "@/lib/billing-rules";
import { can } from "@/lib/rbac";

export type DashboardSections = {
  /** Patient + encounter activity (everyone with dashboard.read). */
  activity: boolean;
  /** Clinical activity — consultations (clinicians / oversight). */
  clinical: boolean;
  /** Billing & cashier summary. */
  billing: boolean;
  /** Hospital management indicators (oversight / admin). */
  management: boolean;
};

/** Capability-driven section visibility — each role sees only what it may. */
export function visibleDashboardSections(roles: readonly string[]): DashboardSections {
  return {
    activity: can(roles, "dashboard.read"),
    clinical: can(roles, "consultation.read"),
    billing: can(roles, "invoice.read"),
    management: can(roles, "audit.read") || can(roles, "config.read"),
  };
}

/** Aggregate a day's payments by mode (recorded only) for the billing/cashier summary. */
export function dailyBillingBreakdown(
  payments: readonly { amount: number; method: string; status: string }[],
): { total: number; count: number; byMethod: MethodTotal[] } {
  const { rows, total, count } = totalsByMethod(payments);
  return { total, count, byMethod: rows };
}
