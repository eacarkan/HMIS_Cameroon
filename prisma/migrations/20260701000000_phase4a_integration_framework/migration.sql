-- Phase 4A — Integration framework & external-system registry (ADDITIVE only; mock/sandbox-first).
-- Hospital-scoped registry of external systems + connector configuration (environment MOCK / SANDBOX /
-- PRODUCTION_DISABLED, never an enabled production) + credential REFERENCES only (never secrets) + an
-- idempotent, audited import/export job framework with status / attempts / last-error tracking.
-- No changes to existing tables; no patient data; no live calls.

-- CreateEnum
CREATE TYPE "IntegrationEnvironment" AS ENUM ('MOCK', 'SANDBOX', 'PRODUCTION_DISABLED');

-- CreateEnum
CREATE TYPE "ExternalSystemStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_CONFIGURATION');

-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationJobEventType" AS ENUM ('CREATED', 'STARTED', 'SUCCEEDED', 'FAILED', 'RETRIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ExternalSystem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "ExternalSystemStatus" NOT NULL DEFAULT 'NEEDS_CONFIGURATION',
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSystemConfig" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "externalSystemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnector" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "externalSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "IntegrationEnvironment" NOT NULL DEFAULT 'MOCK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationCredentialReference" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "externalSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceKind" TEXT NOT NULL,
    "referenceValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCredentialReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationJob" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "externalSystemId" TEXT NOT NULL,
    "connectorId" TEXT,
    "kind" TEXT NOT NULL,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationJobEvent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "IntegrationJobEventType" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSystem_hospitalId_code_key" ON "ExternalSystem"("hospitalId", "code");
CREATE INDEX "ExternalSystem_hospitalId_idx" ON "ExternalSystem"("hospitalId");
CREATE UNIQUE INDEX "ExternalSystemConfig_externalSystemId_key_key" ON "ExternalSystemConfig"("externalSystemId", "key");
CREATE INDEX "ExternalSystemConfig_hospitalId_idx" ON "ExternalSystemConfig"("hospitalId");
CREATE UNIQUE INDEX "IntegrationConnector_externalSystemId_name_key" ON "IntegrationConnector"("externalSystemId", "name");
CREATE INDEX "IntegrationConnector_hospitalId_idx" ON "IntegrationConnector"("hospitalId");
CREATE UNIQUE INDEX "IntegrationCredentialReference_externalSystemId_name_key" ON "IntegrationCredentialReference"("externalSystemId", "name");
CREATE INDEX "IntegrationCredentialReference_hospitalId_idx" ON "IntegrationCredentialReference"("hospitalId");
CREATE UNIQUE INDEX "IntegrationJob_hospitalId_idempotencyKey_key" ON "IntegrationJob"("hospitalId", "idempotencyKey");
CREATE INDEX "IntegrationJob_hospitalId_status_idx" ON "IntegrationJob"("hospitalId", "status");
CREATE INDEX "IntegrationJobEvent_hospitalId_jobId_idx" ON "IntegrationJobEvent"("hospitalId", "jobId");

-- AddForeignKey
ALTER TABLE "ExternalSystem" ADD CONSTRAINT "ExternalSystem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalSystemConfig" ADD CONSTRAINT "ExternalSystemConfig_externalSystemId_fkey" FOREIGN KEY ("externalSystemId") REFERENCES "ExternalSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnector" ADD CONSTRAINT "IntegrationConnector_externalSystemId_fkey" FOREIGN KEY ("externalSystemId") REFERENCES "ExternalSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationCredentialReference" ADD CONSTRAINT "IntegrationCredentialReference_externalSystemId_fkey" FOREIGN KEY ("externalSystemId") REFERENCES "ExternalSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_externalSystemId_fkey" FOREIGN KEY ("externalSystemId") REFERENCES "ExternalSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationJob" ADD CONSTRAINT "IntegrationJob_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "IntegrationConnector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationJobEvent" ADD CONSTRAINT "IntegrationJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegrationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
