-- Add profile completion flag for social signups
ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "needsProfileCompletion" BOOLEAN NOT NULL DEFAULT FALSE;




