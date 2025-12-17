-- Add login security fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Add 2FA fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_email_idx" ON "email_verification_tokens"("email");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_idx" ON "email_verification_tokens"("expires");

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_verification_tokens_userId_fkey'
    ) THEN
        ALTER TABLE "email_verification_tokens" 
        ADD CONSTRAINT "email_verification_tokens_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

