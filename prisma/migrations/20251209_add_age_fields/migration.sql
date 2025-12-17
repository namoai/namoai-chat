-- Add age-related columns for minors handling
ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "declaredAdult" BOOLEAN;



















