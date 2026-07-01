-- Phase 4E — insurance / mutuelle workflow foundation (ADDITIVE only; manual review, no insurer API).
-- Payer registry + coverage profiles + patient coverage link + eligibility PLACEHOLDER + pre-auth +
-- claim draft (manual statuses). No real insurer connectivity, no auto-adjudication, no auto-submission.
-- Billing-linked (a claim may reference an invoice). Integer FCFA. No existing-table change.

-- CreateEnum
CREATE TYPE "PatientCoverageStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "EligibilityStatus" AS ENUM ('UNKNOWN', 'ELIGIBLE_PLACEHOLDER', 'INELIGIBLE_PLACEHOLDER');
CREATE TYPE "PreAuthStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED');
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED_PLACEHOLDER', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageProfile" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coveragePercent" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoverageProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientCoverage" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "coverageProfileId" TEXT,
    "memberNumber" TEXT NOT NULL,
    "status" "PatientCoverageStatus" NOT NULL DEFAULT 'ACTIVE',
    "eligibilityStatus" "EligibilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientCoverageId" TEXT NOT NULL,
    "encounterId" TEXT,
    "description" TEXT NOT NULL,
    "status" "PreAuthStatus" NOT NULL DEFAULT 'REQUESTED',
    "decisionReason" TEXT,
    "requestedById" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDraft" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientCoverageId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "amountClaimed" INTEGER NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClaimDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payer_hospitalId_code_key" ON "Payer"("hospitalId", "code");
CREATE INDEX "Payer_hospitalId_idx" ON "Payer"("hospitalId");
CREATE UNIQUE INDEX "CoverageProfile_hospitalId_code_key" ON "CoverageProfile"("hospitalId", "code");
CREATE INDEX "CoverageProfile_hospitalId_idx" ON "CoverageProfile"("hospitalId");
CREATE INDEX "PatientCoverage_hospitalId_patientId_idx" ON "PatientCoverage"("hospitalId", "patientId");
CREATE INDEX "PreAuthorizationRequest_hospitalId_status_idx" ON "PreAuthorizationRequest"("hospitalId", "status");
CREATE UNIQUE INDEX "ClaimDraft_hospitalId_claimNumber_key" ON "ClaimDraft"("hospitalId", "claimNumber");
CREATE INDEX "ClaimDraft_hospitalId_status_idx" ON "ClaimDraft"("hospitalId", "status");

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoverageProfile" ADD CONSTRAINT "CoverageProfile_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientCoverage" ADD CONSTRAINT "PatientCoverage_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientCoverage" ADD CONSTRAINT "PatientCoverage_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PreAuthorizationRequest" ADD CONSTRAINT "PreAuthorizationRequest_patientCoverageId_fkey" FOREIGN KEY ("patientCoverageId") REFERENCES "PatientCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimDraft" ADD CONSTRAINT "ClaimDraft_patientCoverageId_fkey" FOREIGN KEY ("patientCoverageId") REFERENCES "PatientCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
