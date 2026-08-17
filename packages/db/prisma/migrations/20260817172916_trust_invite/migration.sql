-- CreateTable
CREATE TABLE "TrustInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TrustInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustInviteRedemption" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustInviteRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustInvite_codeHash_key" ON "TrustInvite"("codeHash");

-- CreateIndex
CREATE INDEX "TrustInvite_createdAt_idx" ON "TrustInvite"("createdAt");

-- CreateIndex
CREATE INDEX "TrustInviteRedemption_userId_idx" ON "TrustInviteRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustInviteRedemption_inviteId_userId_key" ON "TrustInviteRedemption"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "TrustInviteRedemption" ADD CONSTRAINT "TrustInviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TrustInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustInviteRedemption" ADD CONSTRAINT "TrustInviteRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

