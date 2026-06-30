import type { SiteReadinessStatus, UatStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * UAT + Gate 7 readiness data access (Phase 3E). Hospital-scoped; one row per (hospital, code/
 * scenario/criterion). Composite-unique upserts (no update-by-id-only). Consumers: services only.
 * Evidence only — no authorization is represented here.
 */

export function listUatScenariosWithExecutions(hospitalId: string) {
  return prisma.uatScenario.findMany({
    where: { hospitalId },
    orderBy: { code: "asc" },
    include: { executions: true },
  });
}

export function countUatScenarios(hospitalId: string) {
  return prisma.uatScenario.count({ where: { hospitalId } });
}

export function upsertUatScenario(
  hospitalId: string,
  code: string,
  data: { category: string; titleFr: string; titleEn?: string | null; expectedResult?: string | null },
) {
  return prisma.uatScenario.upsert({
    where: { hospitalId_code: { hospitalId, code } },
    create: { hospitalId, code, ...data },
    update: { category: data.category, titleFr: data.titleFr, titleEn: data.titleEn, expectedResult: data.expectedResult },
  });
}

export function findUatScenarioByCode(hospitalId: string, code: string) {
  return prisma.uatScenario.findFirst({ where: { hospitalId, code } });
}

export function upsertUatExecution(
  hospitalId: string,
  scenarioId: string,
  data: { status: UatStatus; notes?: string | null; executedById: string; executedAt: Date },
) {
  return prisma.uatExecution.upsert({
    where: { hospitalId_scenarioId: { hospitalId, scenarioId } },
    create: { hospitalId, scenarioId, ...data },
    update: { status: data.status, notes: data.notes, executedById: data.executedById, executedAt: data.executedAt },
  });
}

export function listGate7Items(hospitalId: string) {
  return prisma.gate7ReadinessItem.findMany({ where: { hospitalId }, orderBy: { criterion: "asc" } });
}

export type UpsertGate7Data = {
  status?: SiteReadinessStatus;
  note?: string | null;
  directorSignoffPlaceholder?: string | null;
  minsanteSignoffPlaceholder?: string | null;
};

export function upsertGate7Item(hospitalId: string, criterion: string, data: UpsertGate7Data) {
  return prisma.gate7ReadinessItem.upsert({
    where: { hospitalId_criterion: { hospitalId, criterion } },
    create: { hospitalId, criterion, ...data },
    update: data,
  });
}
