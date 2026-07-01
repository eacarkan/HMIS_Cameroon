import {
  type ReadinessItemView,
  type ReadinessStatus,
  type ReadinessSummary,
  READINESS_CATEGORIES,
  summarizeReadiness,
  validateReadinessUpdate,
} from "@/lib/site-readiness";
import {
  type HospitalContext,
  listSiteReadinessItems,
  upsertSiteReadinessItem,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Site-readiness service (Phase 3C). STATUS TRACKING ONLY — no infrastructure work is performed.
 * Reads merge the fixed category list with the hospital's stored items (defaulting to `not_started`),
 * so the full checklist always shows. Updates are RBAC-checked, hospital-scoped, audited, and gated:
 * a supplier-dependent item cannot be set `ready` without a verifier + evidence (lib rule). Cross-
 * hospital access is impossible (the active context is membership-resolved + per-hospital RBAC).
 */

export type SiteReadinessView = {
  items: ReadinessItemView[];
  summary: ReadinessSummary;
};

/** The full checklist for the active hospital + a readiness roll-up (read-only; `readiness.view`). */
export async function getSiteReadiness(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<SiteReadinessView> {
  await requireCapability(actor, ctx, "readiness.view");
  const stored = await listSiteReadinessItems(ctx.hospitalId);
  const byCategory = new Map(stored.map((s) => [s.category, s]));
  const items: ReadinessItemView[] = READINESS_CATEGORIES.map((c) => {
    const row = byCategory.get(c.key);
    return {
      key: c.key,
      labelFr: c.labelFr,
      labelEn: c.labelEn,
      supplierDependent: c.supplierDependent,
      status: (row?.status ?? "not_started") as ReadinessStatus,
      owner: row?.owner ?? null,
      evidenceNote: row?.evidenceNote ?? null,
      verifier: row?.verifier ?? null,
    };
  });
  return { items, summary: summarizeReadiness(items) };
}

export type SetReadinessInput = {
  status: ReadinessStatus;
  owner?: string | null;
  evidenceNote?: string | null;
  verifier?: string | null;
};

/** Update one checklist item (`readiness.manage`); enforces the supplier-dependent READY gate; audited. */
export async function setReadinessItem(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  category: string,
  input: SetReadinessInput,
) {
  await requireCapability(actor, ctx, "readiness.manage", { type: "SiteReadinessItem", id: category });
  const check = validateReadinessUpdate(category, input);
  if (!check.ok) throw new Error(check.error);

  const item = await upsertSiteReadinessItem(ctx.hospitalId, category, {
    status: input.status,
    owner: input.owner?.trim() || null,
    evidenceNote: input.evidenceNote?.trim() || null,
    verifier: input.verifier?.trim() || null,
    statusDate: new Date(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.readinessStatusChanged,
    entityType: "SiteReadinessItem",
    entityId: item.id,
    summary: `Préparation « ${category} » → ${input.status}`,
  });
  return item;
}
