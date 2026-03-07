-- AlterTable
ALTER TABLE "Audit" ADD COLUMN "reviewerName" TEXT;
ALTER TABLE "Audit" ADD COLUMN "ownerLastSeenUserPinsCount" INTEGER NOT NULL DEFAULT 0;
