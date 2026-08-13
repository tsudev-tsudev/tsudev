-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('APP', 'TOOL', 'LIBRARY', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('WIP', 'BETA', 'STABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CopyrightStatus" AS ENUM ('NONE', 'PENDING', 'REGISTERED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "descriptionMd" TEXT NOT NULL DEFAULT '',
    "kind" "ProjectKind" NOT NULL DEFAULT 'TOOL',
    "status" "ProjectStatus" NOT NULL DEFAULT 'WIP',
    "version" TEXT,
    "releasedAt" TIMESTAMP(3),
    "repoUrl" TEXT,
    "homepageUrl" TEXT,
    "downloadUrl" TEXT,
    "license" TEXT,
    "copyrightStatus" "CopyrightStatus" NOT NULL DEFAULT 'NONE',
    "copyrightNo" TEXT,
    "copyrightAt" TIMESTAMP(3),
    "copyrightOwner" TEXT,
    "trustProgramSlug" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_published_sortOrder_idx" ON "Project"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "Project_kind_status_idx" ON "Project"("kind", "status");

-- CreateIndex
CREATE INDEX "Project_copyrightStatus_idx" ON "Project"("copyrightStatus");

