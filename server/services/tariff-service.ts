import { formatFcfa } from "@/lib/money";
import {
  type HospitalContext,
  listPriceLists as dbListPriceLists,
  createPriceList as dbCreatePriceList,
  findPriceListById,
  updatePriceList as dbUpdatePriceList,
  listTariffs as dbListTariffs,
  createTariff as dbCreateTariff,
  findTariffById,
  updateTariff as dbUpdateTariff,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Tariff / price-list service (Gate 3, 23 §5). SYS/ADM manage; CAI may read (billing
 * context) but NOT mutate. Hospital-scoped. INTEGER FCFA only — no floats, no approval
 * workflow, no accounting/insurance/gateway. A tariff is a configurable SOURCE for
 * billing; the InvoiceItem snapshot is never altered by tariff changes.
 */

function assertIntegerFcfa(amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Montant FCFA invalide — entier positif requis.");
  }
}

// ---- Price lists ----
export async function listPriceLists(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "tariff.read");
  return dbListPriceLists(ctx.hospitalId);
}

export async function createPriceList(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; effectiveFrom?: Date | null; effectiveTo?: Date | null },
) {
  await requireCapability(actor, ctx, "tariff.manage", { type: "PriceList" });
  const priceList = await dbCreatePriceList({
    hospitalId: ctx.hospitalId,
    code: input.code,
    name: input.name,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.priceListCreate,
    entityType: "PriceList",
    entityId: priceList.id,
    summary: `Création de la liste tarifaire ${priceList.name} (${priceList.code})`,
  });
  return priceList;
}

export async function deactivatePriceList(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "tariff.manage", { type: "PriceList", id });
  const existing = await findPriceListById(ctx.hospitalId, id);
  if (!existing) throw new Error("Liste tarifaire introuvable dans cet hôpital.");
  const priceList = await dbUpdatePriceList(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.priceListDeactivate,
    entityType: "PriceList",
    entityId: id,
    summary: `Désactivation de la liste tarifaire ${priceList.code}`,
  });
  return priceList;
}

// ---- Tariffs (integer FCFA) ----
export async function listTariffs(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "tariff.read");
  return dbListTariffs(ctx.hospitalId);
}

export async function createTariff(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: {
    code: string;
    label: string;
    amount: number;
    priceListId?: string | null;
    // Phase 2C — optional effective dates (informational; snapshots remain immutable).
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  },
) {
  await requireCapability(actor, ctx, "tariff.manage", { type: "Tariff" });
  assertIntegerFcfa(input.amount);
  if (input.priceListId) {
    const pl = await findPriceListById(ctx.hospitalId, input.priceListId);
    if (!pl) throw new Error("Liste tarifaire invalide pour cet hôpital.");
  }
  const tariff = await dbCreateTariff({
    hospitalId: ctx.hospitalId,
    priceListId: input.priceListId ?? null,
    code: input.code,
    label: input.label,
    amount: input.amount,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.tariffCreate,
    entityType: "Tariff",
    entityId: tariff.id,
    summary: `Création du tarif ${tariff.label} (${formatFcfa(tariff.amount)})`,
  });
  return tariff;
}

export async function updateTariff(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  input: {
    label?: string;
    amount?: number;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  },
) {
  await requireCapability(actor, ctx, "tariff.manage", { type: "Tariff", id });
  if (input.amount !== undefined) assertIntegerFcfa(input.amount);
  const existing = await findTariffById(ctx.hospitalId, id);
  if (!existing) throw new Error("Tarif introuvable dans cet hôpital.");
  const tariff = await dbUpdateTariff(id, {
    label: input.label,
    amount: input.amount,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.tariffUpdate,
    entityType: "Tariff",
    entityId: id,
    summary: `Mise à jour du tarif ${tariff.code} (${formatFcfa(tariff.amount)})`,
  });
  return tariff;
}

export async function deactivateTariff(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "tariff.manage", { type: "Tariff", id });
  const existing = await findTariffById(ctx.hospitalId, id);
  if (!existing) throw new Error("Tarif introuvable dans cet hôpital.");
  const tariff = await dbUpdateTariff(id, { isActive: false });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.tariffDeactivate,
    entityType: "Tariff",
    entityId: id,
    summary: `Désactivation du tarif ${tariff.code}`,
  });
  return tariff;
}
