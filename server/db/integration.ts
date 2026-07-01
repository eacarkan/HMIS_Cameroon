import type {
  ExternalSystemStatus,
  IntegrationEnvironment,
  IntegrationJobEventType,
  IntegrationJobStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4A — integration framework data-access (hospital-scoped). The ONLY place Prisma is called for
 * the external-system registry + connector config + credential REFERENCES (never secrets) + the
 * idempotent, status/attempt/error-tracked job framework. Every read/write carries `hospitalId`;
 * job state transitions are GUARDED `updateMany` claims (no update-by-id-only), so a concurrent
 * double-run can never double-execute. No patient data here, no network.
 */

// ---- External systems (registry) ----

export type CreateExternalSystemData = {
  hospitalId: string;
  code: string;
  name: string;
  kind: string;
  description?: string | null;
  status?: ExternalSystemStatus;
  createdById?: string | null;
};

export function listExternalSystems(hospitalId: string) {
  return prisma.externalSystem.findMany({
    where: { hospitalId },
    orderBy: { code: "asc" },
    include: { connectors: true, credentialReferences: true, configs: true },
  });
}

export function findExternalSystemById(hospitalId: string, id: string) {
  return prisma.externalSystem.findFirst({
    where: { id, hospitalId },
    include: { connectors: true, credentialReferences: true, configs: true },
  });
}

export function findExternalSystemByCode(hospitalId: string, code: string) {
  return prisma.externalSystem.findFirst({ where: { hospitalId, code } });
}

export function createExternalSystem(data: CreateExternalSystemData) {
  return prisma.externalSystem.create({ data });
}

export function updateExternalSystem(
  hospitalId: string,
  id: string,
  data: { name?: string; kind?: string; description?: string | null; status?: ExternalSystemStatus },
) {
  return prisma.externalSystem.updateMany({ where: { id, hospitalId }, data });
}

// ---- External-system config (non-secret placeholders) ----

export function listExternalSystemConfigs(hospitalId: string, externalSystemId: string) {
  return prisma.externalSystemConfig.findMany({
    where: { hospitalId, externalSystemId },
    orderBy: { key: "asc" },
  });
}

export function upsertExternalSystemConfig(params: {
  hospitalId: string;
  externalSystemId: string;
  key: string;
  value: string;
}) {
  const { hospitalId, externalSystemId, key, value } = params;
  return prisma.externalSystemConfig.upsert({
    where: { externalSystemId_key: { externalSystemId, key } },
    create: { hospitalId, externalSystemId, key, value },
    update: { value },
  });
}

// ---- Connectors ----

export function listConnectors(hospitalId: string, externalSystemId: string) {
  return prisma.integrationConnector.findMany({
    where: { hospitalId, externalSystemId },
    orderBy: { name: "asc" },
  });
}

export function findConnectorById(hospitalId: string, id: string) {
  return prisma.integrationConnector.findFirst({ where: { id, hospitalId } });
}

export function upsertConnector(params: {
  hospitalId: string;
  externalSystemId: string;
  name: string;
  environment: IntegrationEnvironment;
  isActive?: boolean;
}) {
  const { hospitalId, externalSystemId, name, environment, isActive } = params;
  return prisma.integrationConnector.upsert({
    where: { externalSystemId_name: { externalSystemId, name } },
    create: { hospitalId, externalSystemId, name, environment, isActive: isActive ?? true },
    update: { environment, ...(isActive === undefined ? {} : { isActive }) },
  });
}

export function setConnectorLastError(hospitalId: string, id: string, lastError: string | null) {
  return prisma.integrationConnector.updateMany({ where: { id, hospitalId }, data: { lastError } });
}

// ---- Credential references (NEVER a secret) ----

export function listCredentialReferences(hospitalId: string, externalSystemId: string) {
  return prisma.integrationCredentialReference.findMany({
    where: { hospitalId, externalSystemId },
    orderBy: { name: "asc" },
  });
}

export function upsertCredentialReference(params: {
  hospitalId: string;
  externalSystemId: string;
  name: string;
  referenceKind: string;
  referenceValue: string;
}) {
  const { hospitalId, externalSystemId, name, referenceKind, referenceValue } = params;
  return prisma.integrationCredentialReference.upsert({
    where: { externalSystemId_name: { externalSystemId, name } },
    create: { hospitalId, externalSystemId, name, referenceKind, referenceValue },
    update: { referenceKind, referenceValue },
  });
}

// ---- Jobs (idempotent create + guarded transitions + events) ----

export type CreateIntegrationJobData = {
  hospitalId: string;
  externalSystemId: string;
  connectorId?: string | null;
  kind: string;
  idempotencyKey: string;
  maxAttempts?: number;
  payload?: Prisma.InputJsonValue;
  createdById?: string | null;
};

export function listIntegrationJobs(hospitalId: string, opts: { limit?: number } = {}) {
  return prisma.integrationJob.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
    include: { externalSystem: { select: { code: true, name: true } }, connector: { select: { name: true, environment: true } } },
  });
}

export function findIntegrationJobById(hospitalId: string, id: string) {
  return prisma.integrationJob.findFirst({
    where: { id, hospitalId },
    include: { events: { orderBy: { createdAt: "asc" } }, externalSystem: true, connector: true },
  });
}

export function findJobByIdempotencyKey(hospitalId: string, idempotencyKey: string) {
  return prisma.integrationJob.findUnique({
    where: { hospitalId_idempotencyKey: { hospitalId, idempotencyKey } },
  });
}

/** Idempotent create: a repeated request with the same key returns the existing job (created:false). */
export async function createIntegrationJobIdempotent(
  data: CreateIntegrationJobData,
): Promise<{ jobId: string; created: boolean }> {
  const existing = await findJobByIdempotencyKey(data.hospitalId, data.idempotencyKey);
  if (existing) return { jobId: existing.id, created: false };
  try {
    const job = await prisma.integrationJob.create({
      data: {
        hospitalId: data.hospitalId,
        externalSystemId: data.externalSystemId,
        connectorId: data.connectorId ?? null,
        kind: data.kind,
        idempotencyKey: data.idempotencyKey,
        maxAttempts: data.maxAttempts ?? 3,
        payload: data.payload,
        createdById: data.createdById ?? null,
      },
    });
    return { jobId: job.id, created: true };
  } catch {
    // A concurrent create won the unique race — return that one (still idempotent).
    const job = await prisma.integrationJob.findUniqueOrThrow({
      where: { hospitalId_idempotencyKey: { hospitalId: data.hospitalId, idempotencyKey: data.idempotencyKey } },
    });
    return { jobId: job.id, created: false };
  }
}

/**
 * Claim a job for a run: guarded PENDING|FAILED → RUNNING (+attempt, startedAt). Returns true only for
 * the one caller that wins the transition — a concurrent double-run sees count 0 and must not execute.
 */
export async function claimIntegrationJob(hospitalId: string, id: string): Promise<boolean> {
  const res = await prisma.integrationJob.updateMany({
    where: { id, hospitalId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), lastError: null },
  });
  return res.count === 1;
}

/** Complete a running job: guarded RUNNING → SUCCEEDED|FAILED (+result/lastError, finishedAt). */
export async function completeIntegrationJob(
  hospitalId: string,
  id: string,
  outcome: { status: IntegrationJobStatus; result?: Prisma.InputJsonValue; lastError?: string | null },
) {
  return prisma.integrationJob.updateMany({
    where: { id, hospitalId, status: "RUNNING" },
    data: {
      status: outcome.status,
      result: outcome.result,
      lastError: outcome.lastError ?? null,
      finishedAt: new Date(),
    },
  });
}

export function appendJobEvent(
  hospitalId: string,
  jobId: string,
  type: IntegrationJobEventType,
  message?: string | null,
) {
  return prisma.integrationJobEvent.create({
    data: { hospitalId, jobId, type, message: message ?? null },
  });
}
