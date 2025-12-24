-- Add expiration date columns to points table
ALTER TABLE "points" ADD COLUMN "freePointsExpiresAt" TIMESTAMPTZ;
ALTER TABLE "points" ADD COLUMN "paidPointsExpiresAt" TIMESTAMPTZ;


