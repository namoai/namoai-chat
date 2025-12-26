-- Create ip_block table
CREATE TABLE IF NOT EXISTS "ip_block" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "blockedBy" INTEGER,
    "blockedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_block_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ip_block_ip_key" UNIQUE ("ip")
);

-- Create admin_ip_allowlist table
CREATE TABLE IF NOT EXISTS "admin_ip_allowlist" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_ip_allowlist_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_ip_allowlist_ip_key" UNIQUE ("ip")
);

-- Create indexes for ip_block
CREATE INDEX IF NOT EXISTS "ip_block_blockedAt_idx" ON "ip_block"("blockedAt");
CREATE INDEX IF NOT EXISTS "ip_block_ip_idx" ON "ip_block"("ip");

-- Create indexes for admin_ip_allowlist
CREATE INDEX IF NOT EXISTS "admin_ip_allowlist_createdAt_idx" ON "admin_ip_allowlist"("createdAt");

-- Add foreign key constraint for ip_block.blockedBy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ip_block_blockedBy_fkey'
    ) THEN
        ALTER TABLE "ip_block" ADD CONSTRAINT "ip_block_blockedBy_fkey" 
        FOREIGN KEY ("blockedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

