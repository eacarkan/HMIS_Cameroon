import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Audit data-access (09 §7). The only place AuditLog rows are written. Audit is
 * append-only — there is intentionally no update/delete here. Entries are created
 * from the service layer as part of a use-case, never by hand from the UI.
 */

export type AuditEntryInput = {
  hospitalId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

/** List audit entries for a hospital, newest first, optionally filtered by action. */
export function findAuditEntries(
  hospitalId: string,
  opts: { action?: string; limit?: number } = {},
) {
  return prisma.auditLog.findMany({
    where: { hospitalId, ...(opts.action ? { action: opts.action } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: { actor: true },
  });
}

/**
 * Chronological audit trail for one entity (Phase 1A Batch 1B). Hospital-scoped, oldest
 * first — the source for an encounter's status history (no dedicated history table).
 */
export function findEntityAuditTrail(
  hospitalId: string,
  entityType: string,
  entityId: string,
  actions?: string[],
) {
  return prisma.auditLog.findMany({
    where: {
      hospitalId,
      entityType,
      entityId,
      ...(actions && actions.length ? { action: { in: actions } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { actor: true },
  });
}

/** A single audit entry within a hospital, with its actor (for the detail view). */
export function findAuditEntryById(hospitalId: string, id: string) {
  return prisma.auditLog.findFirst({
    where: { id, hospitalId },
    include: { actor: true },
  });
}

export function createAuditEntry(entry: AuditEntryInput) {
  return prisma.auditLog.create({
    data: {
      hospitalId: entry.hospitalId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata,
    },
  });
}
