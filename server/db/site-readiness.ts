import type { SiteReadinessStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Site-readiness data access (Phase 3C). Hospital-scoped status-tracking items; one row per
 * (hospital, category). Every read/write carries `hospitalId`; the upsert is keyed by the
 * composite unique (no update-by-id-only). Consumers are `server/services` only.
 */

export function listSiteReadinessItems(hospitalId: string) {
  return prisma.siteReadinessItem.findMany({
    where: { hospitalId },
    orderBy: { category: "asc" },
  });
}

export type UpsertSiteReadinessData = {
  status: SiteReadinessStatus;
  owner?: string | null;
  evidenceNote?: string | null;
  verifier?: string | null;
  statusDate?: Date | null;
};

/** Create or update one readiness item for (hospital, category) — scoped composite-unique upsert. */
export function upsertSiteReadinessItem(
  hospitalId: string,
  category: string,
  data: UpsertSiteReadinessData,
) {
  return prisma.siteReadinessItem.upsert({
    where: { hospitalId_category: { hospitalId, category } },
    create: { hospitalId, category, ...data },
    update: data,
  });
}
