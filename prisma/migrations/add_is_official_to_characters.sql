-- Add isOfficial column to characters table
-- This field marks official characters (ナモアイフレンズ)

ALTER TABLE "characters" 
ADD COLUMN IF NOT EXISTS "isOfficial" BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "characters"."isOfficial" IS 'Marks official characters (ナモアイフレンズ) that appear in the official characters section on the main page';





