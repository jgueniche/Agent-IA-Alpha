-- AlterTable
ALTER TABLE "followups" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "marketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerRef" TEXT;

