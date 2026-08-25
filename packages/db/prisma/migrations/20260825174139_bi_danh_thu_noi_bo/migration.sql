-- CreateTable
CREATE TABLE "EmailAlias" (
    "id" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cfRuleId" TEXT,
    "userId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAlias_localPart_key" ON "EmailAlias"("localPart");

-- CreateIndex
CREATE INDEX "EmailAlias_userId_idx" ON "EmailAlias"("userId");

-- AddForeignKey
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
