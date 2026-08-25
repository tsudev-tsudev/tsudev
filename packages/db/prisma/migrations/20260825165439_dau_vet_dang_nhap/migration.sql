-- AlterTable
ALTER TABLE "SecurityEvent" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginCountry" TEXT,
ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "lastLoginMethod" TEXT;

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE INDEX "User_lastLoginCountry_idx" ON "User"("lastLoginCountry");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");
