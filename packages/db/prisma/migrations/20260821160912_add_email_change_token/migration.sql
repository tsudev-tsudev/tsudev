-- AlterEnum
ALTER TYPE "AuthTokenPurpose" ADD VALUE 'EMAIL_CHANGE';

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "newEmail" TEXT;
