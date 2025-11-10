-- Create reports table
CREATE TABLE IF NOT EXISTS "reports" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "characterId" INTEGER,
    "reporterId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "reports_characterId_idx" ON "reports"("characterId");
CREATE INDEX IF NOT EXISTS "reports_reporterId_idx" ON "reports"("reporterId");
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_type_idx" ON "reports"("type");
CREATE INDEX IF NOT EXISTS "reports_createdAt_idx" ON "reports"("createdAt");

-- Add foreign key constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reports_characterId_fkey'
    ) THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_characterId_fkey" 
        FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reports_reporterId_fkey'
    ) THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" 
        FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

