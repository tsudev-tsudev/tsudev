-- CreateEnum
CREATE TYPE "TrustOrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DomainVerifyMethod" AS ENUM ('DNS_TXT', 'META_TAG', 'FILE');

-- CreateEnum
CREATE TYPE "DomainVerifyStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SealApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssessmentBasis" AS ENUM ('SELF_DECLARED', 'EVIDENCE_REVIEWED', 'AUDITED');

-- CreateTable
CREATE TABLE "TrustOrganization" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "country" TEXT,
    "contactEmail" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "status" "TrustOrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustDomain" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "method" "DomainVerifyMethod" NOT NULL DEFAULT 'DNS_TXT',
    "token" TEXT NOT NULL,
    "status" "DomainVerifyStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SealProgram" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "evidenceSpec" JSONB NOT NULL,
    "validityDays" INTEGER NOT NULL DEFAULT 365,
    "feeCredits" INTEGER NOT NULL DEFAULT 0,
    "badgeVariant" TEXT NOT NULL DEFAULT 'default',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SealProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SealApplication" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "SealApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "scope" TEXT,
    "answers" JSONB,
    "feeCharged" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SealApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SealEvidence" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT,
    "fileObjectId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SealEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCertificate" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "basis" "AssessmentBasis" NOT NULL DEFAULT 'EVIDENCE_REVIEWED',
    "scope" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "signingKeyId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckPassed" BOOLEAN,

    CONSTRAINT "TrustCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustCheck" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,
    "details" JSONB,

    CONSTRAINT "TrustCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustOrganization_ownerUserId_idx" ON "TrustOrganization"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustDomain_hostname_key" ON "TrustDomain"("hostname");

-- CreateIndex
CREATE INDEX "TrustDomain_orgId_idx" ON "TrustDomain"("orgId");

-- CreateIndex
CREATE INDEX "TrustDomain_status_idx" ON "TrustDomain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SealProgram_slug_key" ON "SealProgram"("slug");

-- CreateIndex
CREATE INDEX "SealApplication_status_submittedAt_idx" ON "SealApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "SealApplication_orgId_idx" ON "SealApplication"("orgId");

-- CreateIndex
CREATE INDEX "SealApplication_applicantId_idx" ON "SealApplication"("applicantId");

-- CreateIndex
CREATE INDEX "SealEvidence_applicationId_idx" ON "SealEvidence"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCertificate_serial_key" ON "TrustCertificate"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "TrustCertificate_applicationId_key" ON "TrustCertificate"("applicationId");

-- CreateIndex
CREATE INDEX "TrustCertificate_status_expiresAt_idx" ON "TrustCertificate"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TrustCertificate_domainId_idx" ON "TrustCertificate"("domainId");

-- CreateIndex
CREATE INDEX "TrustCertificate_orgId_idx" ON "TrustCertificate"("orgId");

-- CreateIndex
CREATE INDEX "TrustCheck_certificateId_ranAt_idx" ON "TrustCheck"("certificateId", "ranAt");

-- CreateIndex
CREATE INDEX "TrustAuditLog_createdAt_idx" ON "TrustAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrustAuditLog_targetType_targetId_idx" ON "TrustAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "TrustDomain" ADD CONSTRAINT "TrustDomain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "TrustOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SealApplication" ADD CONSTRAINT "SealApplication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "TrustOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SealApplication" ADD CONSTRAINT "SealApplication_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "TrustDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SealApplication" ADD CONSTRAINT "SealApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "SealProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SealEvidence" ADD CONSTRAINT "SealEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SealApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SealApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "TrustOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "TrustDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCertificate" ADD CONSTRAINT "TrustCertificate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "SealProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustCheck" ADD CONSTRAINT "TrustCheck_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "TrustCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
