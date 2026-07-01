import type { Prisma } from "@prisma/client";

import {
  appendJobEvent,
  claimIntegrationJob,
  completeIntegrationJob,
  createExternalSystem,
  createIntegrationJobIdempotent,
  findConnectorById,
  findExternalSystemByCode,
  findExternalSystemById,
  findIntegrationJobById,
  listConnectors,
  listExternalSystems,
  listIntegrationJobs,
  setConnectorLastError,
  updateExternalSystem,
  upsertConnector,
  upsertCredentialReference,
  upsertExternalSystemConfig,
  type HospitalContext,
} from "@/server/db";
import {
  buildJobIdempotencyKey,
  canClaimJob,
  canRetryJob,
  type ConnectorEnvironment,
  isLiveIntegrationEnabled,
  isTerminalJobStatus,
  resolveConnectorAdapter,
  validateConnectorInput,
  validateCredentialReference,
  validateExternalSystemInput,
} from "@/lib/integration";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Integration framework service (Phase 4A). Registry CRUD + connector configuration + credential
 * REFERENCES (never secrets) + an idempotent, audited job runner. The runner resolves a connector
 * through the adapter interface — the default is a MOCK that makes NO network call. A connector in
 * the `PRODUCTION_DISABLED` environment can never run (it fails safely, audited), so NO live external
 * call can originate here while the live feature flag is OFF (the default). INTEGRATION-admin
 * (`integration.system.manage`) is separate from clinical roles; everything is hospital-scoped + audited.
 */

export type IntegrationOverview = Awaited<ReturnType<typeof getIntegrationOverview>>;

export async function getIntegrationOverview(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "integration.job.view");
  const [systems, jobs] = await Promise.all([
    listExternalSystems(ctx.hospitalId),
    listIntegrationJobs(ctx.hospitalId, { limit: 30 }),
  ]);
  return { systems, jobs, liveEnabled: isLiveIntegrationEnabled() };
}

export async function getIntegrationJob(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "integration.job.view");
  return findIntegrationJobById(ctx.hospitalId, id);
}

// ---- Registry management (integration.system.manage) ----

export async function createExternalSystemForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { code: string; name: string; kind: string; description?: string | null },
) {
  await requireCapability(actor, ctx, "integration.system.manage", { type: "ExternalSystem" });
  const check = validateExternalSystemInput(input);
  if (!check.ok) throw new Error(check.error);
  const code = input.code.trim().toUpperCase();
  if (await findExternalSystemByCode(ctx.hospitalId, code)) {
    throw new Error("Un système externe avec ce code existe déjà dans cet hôpital.");
  }
  const system = await createExternalSystem({
    hospitalId: ctx.hospitalId,
    code,
    name: input.name.trim(),
    kind: input.kind.trim(),
    description: input.description?.trim() || null,
    status: "NEEDS_CONFIGURATION",
    createdById: actor.id,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationSystemCreated,
    entityType: "ExternalSystem",
    entityId: system.id,
    summary: `Système externe créé : ${code} — ${system.name} (${system.kind}) [FICTIF]`,
  });
  return system;
}

export async function setExternalSystemStatusForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  status: "ACTIVE" | "INACTIVE" | "NEEDS_CONFIGURATION",
) {
  await requireCapability(actor, ctx, "integration.system.manage", { type: "ExternalSystem", id });
  const system = await findExternalSystemById(ctx.hospitalId, id);
  if (!system) throw new Error("Système externe introuvable dans cet hôpital.");
  await updateExternalSystem(ctx.hospitalId, id, { status });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationSystemUpdated,
    entityType: "ExternalSystem",
    entityId: id,
    summary: `Système externe ${system.code} — statut → ${status}`,
  });
  return findExternalSystemById(ctx.hospitalId, id);
}

export async function configureConnectorForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { externalSystemId: string; name: string; environment: string; isActive?: boolean },
) {
  await requireCapability(actor, ctx, "integration.system.manage", { type: "IntegrationConnector" });
  const check = validateConnectorInput(input);
  if (!check.ok) throw new Error(check.error);
  const system = await findExternalSystemById(ctx.hospitalId, input.externalSystemId);
  if (!system) throw new Error("Système externe introuvable dans cet hôpital.");
  const connector = await upsertConnector({
    hospitalId: ctx.hospitalId,
    externalSystemId: system.id,
    name: input.name.trim(),
    environment: input.environment as ConnectorEnvironment,
    isActive: input.isActive,
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationConnectorConfigured,
    entityType: "IntegrationConnector",
    entityId: connector.id,
    summary: `Connecteur « ${connector.name} » configuré (${connector.environment}) pour ${system.code} [FICTIF]`,
  });
  return connector;
}

export async function setExternalSystemConfigForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { externalSystemId: string; key: string; value: string },
) {
  await requireCapability(actor, ctx, "integration.system.manage", { type: "ExternalSystemConfig" });
  if (!input.key?.trim()) throw new Error("La clé de configuration est obligatoire.");
  const system = await findExternalSystemById(ctx.hospitalId, input.externalSystemId);
  if (!system) throw new Error("Système externe introuvable dans cet hôpital.");
  const config = await upsertExternalSystemConfig({
    hospitalId: ctx.hospitalId,
    externalSystemId: system.id,
    key: input.key.trim(),
    value: input.value ?? "",
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationConnectorConfigured,
    entityType: "ExternalSystemConfig",
    entityId: config.id,
    summary: `Configuration « ${config.key} » définie pour ${system.code}`,
  });
  return config;
}

export async function addCredentialReferenceForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { externalSystemId: string; name: string; referenceKind: string; referenceValue: string },
) {
  await requireCapability(actor, ctx, "integration.system.manage", {
    type: "IntegrationCredentialReference",
  });
  // GUARD: a credential REFERENCE must never be an actual secret.
  const check = validateCredentialReference(input);
  if (!check.ok) throw new Error(check.error);
  const system = await findExternalSystemById(ctx.hospitalId, input.externalSystemId);
  if (!system) throw new Error("Système externe introuvable dans cet hôpital.");
  const ref = await upsertCredentialReference({
    hospitalId: ctx.hospitalId,
    externalSystemId: system.id,
    name: input.name.trim(),
    referenceKind: input.referenceKind,
    referenceValue: input.referenceValue.trim(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationConnectorConfigured,
    entityType: "IntegrationCredentialReference",
    entityId: ref.id,
    summary: `Référence d'identifiant « ${ref.name} » (${ref.referenceKind}) enregistrée pour ${system.code} — RÉFÉRENCE uniquement, aucun secret`,
  });
  return ref;
}

// ---- Job runner (idempotent, egress-safe, audited) ----

/** Run (or re-run idempotently) a MOCK integration job. `integration.system.manage` required. */
export async function runIntegrationJobForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: {
    externalSystemId: string;
    connectorId?: string | null;
    kind: string;
    ref: string;
    payload?: Record<string, unknown>;
  },
) {
  await requireCapability(actor, ctx, "integration.system.manage", { type: "IntegrationJob" });
  const system = await findExternalSystemById(ctx.hospitalId, input.externalSystemId);
  if (!system) throw new Error("Système externe introuvable dans cet hôpital.");

  let connectorId = input.connectorId ?? null;
  if (connectorId) {
    const connector = await findConnectorById(ctx.hospitalId, connectorId);
    if (!connector) throw new Error("Connecteur introuvable dans cet hôpital.");
  } else {
    const connectors = await listConnectors(ctx.hospitalId, system.id);
    connectorId = (connectors.find((c) => c.isActive) ?? connectors[0])?.id ?? null;
  }

  const idempotencyKey = buildJobIdempotencyKey({
    externalSystemId: system.id,
    kind: input.kind,
    ref: input.ref,
  });
  const { jobId, created } = await createIntegrationJobIdempotent({
    hospitalId: ctx.hospitalId,
    externalSystemId: system.id,
    connectorId,
    kind: input.kind,
    idempotencyKey,
    payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    createdById: actor.id,
  });
  if (created) {
    await appendJobEvent(ctx.hospitalId, jobId, "CREATED", "Tâche d'intégration créée (fictive).");
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.integrationJobCreated,
      entityType: "IntegrationJob",
      entityId: jobId,
      summary: `Tâche d'intégration créée — ${input.kind} (${system.code}) [FICTIF]`,
    });
  }
  return executeIntegrationJob(actor, ctx, jobId);
}

export async function retryIntegrationJobForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  jobId: string,
) {
  await requireCapability(actor, ctx, "integration.job.retry", { type: "IntegrationJob", id: jobId });
  const job = await findIntegrationJobById(ctx.hospitalId, jobId);
  if (!job) throw new Error("Tâche introuvable dans cet hôpital.");
  if (!canRetryJob(job.status, job.attempts, job.maxAttempts)) {
    throw new Error(
      "Seule une tâche en ÉCHEC avec des tentatives restantes peut être relancée.",
    );
  }
  await appendJobEvent(ctx.hospitalId, jobId, "RETRIED", `Relance manuelle (tentative ${job.attempts + 1}).`);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationJobRetried,
    entityType: "IntegrationJob",
    entityId: jobId,
    summary: `Tâche relancée — ${job.kind} (tentative ${job.attempts + 1})`,
  });
  return executeIntegrationJob(actor, ctx, jobId);
}

/**
 * Execute a job through the adapter. Claims RUNNING with a guarded transition (a concurrent run sees
 * count 0 and does NOT execute → no double effect). The adapter is the MOCK for MOCK/SANDBOX; a
 * PRODUCTION_DISABLED connector resolves to a thrown `IntegrationLiveDisabledError`, so the job fails
 * SAFELY (audited) and NO network call is made. Audit-after-commit, consistent with the codebase.
 */
async function executeIntegrationJob(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  jobId: string,
) {
  const job = await findIntegrationJobById(ctx.hospitalId, jobId);
  if (!job) throw new Error("Tâche introuvable.");
  // Already finished successfully/cancelled → idempotent no-op.
  if (isTerminalJobStatus(job.status)) return job;
  if (!canClaimJob(job.status, job.attempts, job.maxAttempts)) return job; // FAILED + exhausted

  const claimed = await claimIntegrationJob(ctx.hospitalId, jobId);
  if (!claimed) return findIntegrationJobById(ctx.hospitalId, jobId); // a concurrent run won the claim

  const environment = (job.connector?.environment ?? "MOCK") as ConnectorEnvironment;
  await appendJobEvent(ctx.hospitalId, jobId, "STARTED", `Exécution du connecteur (${environment}).`);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.integrationJobStarted,
    entityType: "IntegrationJob",
    entityId: jobId,
    summary: `Tâche démarrée — ${job.kind} (${environment})`,
  });

  try {
    const adapter = resolveConnectorAdapter(environment, { liveEnabled: isLiveIntegrationEnabled() });
    const result = await adapter.run({ jobKind: job.kind, payload: job.payload });
    await completeIntegrationJob(ctx.hospitalId, jobId, {
      status: "SUCCEEDED",
      result: { ok: result.ok, detail: result.detail, output: result.output ?? null } as unknown as Prisma.InputJsonValue,
    });
    if (job.connectorId) await setConnectorLastError(ctx.hospitalId, job.connectorId, null);
    await appendJobEvent(ctx.hospitalId, jobId, "SUCCEEDED", result.detail);
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.integrationJobSucceeded,
      entityType: "IntegrationJob",
      entityId: jobId,
      summary: `Tâche réussie (fictive) — ${job.kind}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    await completeIntegrationJob(ctx.hospitalId, jobId, { status: "FAILED", lastError: message });
    if (job.connectorId) await setConnectorLastError(ctx.hospitalId, job.connectorId, message);
    await appendJobEvent(ctx.hospitalId, jobId, "FAILED", message);
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.integrationJobFailed,
      entityType: "IntegrationJob",
      entityId: jobId,
      summary: `Tâche échouée — ${job.kind} : ${message}`,
    });
  }
  return findIntegrationJobById(ctx.hospitalId, jobId);
}
