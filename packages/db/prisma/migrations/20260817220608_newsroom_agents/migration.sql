-- CreateEnum
CREATE TYPE "AgentDept" AS ENUM ('RESEARCH', 'EDITORIAL', 'PUBLISHING', 'SEO');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('IDLE', 'PLANNING', 'SCANNING', 'WRITING', 'REVIEWING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('IDEA', 'IN_PROGRESS', 'PENDING_REVIEW', 'PENDING_HUMAN', 'REJECTED_WITH_FEEDBACK', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DraftTarget" AS ENUM ('BLOG', 'DOC', 'PROJECT', 'TRUST');

-- CreateEnum
CREATE TYPE "Autonomy" AS ENUM ('FULL_AUTO', 'HUMAN_APPROVAL', 'DRAFT_ONLY');

-- CreateEnum
CREATE TYPE "NewsroomEventStatus" AS ENUM ('PENDING', 'CLAIMED', 'DONE', 'FAILED', 'DEAD');

-- AlterTable
ALTER TABLE "Doc" ADD COLUMN     "authoredByAgentId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "sourceDraftId" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "authoredByAgentId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "sourceDraftId" TEXT;

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dept" "AgentDept" NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'workers-ai',
    "model" TEXT NOT NULL DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    "systemPrompt" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'IDLE',
    "statusNote" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsroomChannel" (
    "id" TEXT NOT NULL,
    "target" "DraftTarget" NOT NULL,
    "autonomy" "Autonomy" NOT NULL DEFAULT 'FULL_AUTO',
    "styleGuide" TEXT NOT NULL,
    "dailyPostCap" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsroomChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsroomSource" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "target" "DraftTarget" NOT NULL,
    "rewriteOnly" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScanAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsroomSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicIdea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "target" "DraftTarget" NOT NULL,
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "target" "DraftTarget" NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'IDEA',
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMd" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaTitle" TEXT,
    "metaDesc" TEXT,
    "topicId" TEXT,
    "authorAgentId" TEXT,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "reviewFeedback" TEXT,
    "publishedPostId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftRevision" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "draftId" TEXT,
    "action" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN,
    "errorMsg" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "neuronsUsed" INTEGER NOT NULL DEFAULT 0,
    "usedProvider" TEXT NOT NULL DEFAULT 'workers-ai',

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsroomEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "NewsroomEventStatus" NOT NULL DEFAULT 'PENDING',
    "draftId" TEXT,
    "agentId" TEXT,
    "actorKind" TEXT NOT NULL DEFAULT 'agent',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsroomEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_slug_key" ON "AgentProfile"("slug");

-- CreateIndex
CREATE INDEX "AgentProfile_dept_status_idx" ON "AgentProfile"("dept", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NewsroomChannel_target_key" ON "NewsroomChannel"("target");

-- CreateIndex
CREATE INDEX "NewsroomSource_enabled_lastScanAt_idx" ON "NewsroomSource"("enabled", "lastScanAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopicIdea_fingerprint_key" ON "TopicIdea"("fingerprint");

-- CreateIndex
CREATE INDEX "TopicIdea_consumedAt_score_idx" ON "TopicIdea"("consumedAt", "score");

-- CreateIndex
CREATE INDEX "ContentDraft_status_target_updatedAt_idx" ON "ContentDraft"("status", "target", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentDraft_deletedAt_idx" ON "ContentDraft"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftRevision_draftId_seq_key" ON "DraftRevision"("draftId", "seq");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_startedAt_idx" ON "AgentRun"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_leaseUntil_idx" ON "AgentRun"("leaseUntil");

-- CreateIndex
CREATE INDEX "NewsroomEvent_status_createdAt_idx" ON "NewsroomEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NewsroomEvent_draftId_createdAt_idx" ON "NewsroomEvent"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "Doc_deletedAt_idx" ON "Doc"("deletedAt");

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- AddForeignKey
ALTER TABLE "TopicIdea" ADD CONSTRAINT "TopicIdea_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsroomSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "AgentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftRevision" ADD CONSTRAINT "DraftRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
