-- Add point transaction tracking system
-- This allows individual point batches to expire independently

-- Create point_transactions table
CREATE TABLE "point_transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance" INTEGER NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "payment_id" INTEGER,
  "acquired_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create indexes for point_transactions
CREATE INDEX "point_transactions_user_id_expires_at_idx" ON "point_transactions"("user_id", "expires_at");
CREATE INDEX "point_transactions_user_id_created_at_idx" ON "point_transactions"("user_id", "created_at");
CREATE INDEX "point_transactions_payment_id_idx" ON "point_transactions"("payment_id");

-- Create point_usage_history table
CREATE TABLE "point_usage_history" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "points_used" INTEGER NOT NULL,
  "usage_type" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "related_chat_id" INTEGER,
  "related_message_id" INTEGER,
  "transaction_details" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_user_usage" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create indexes for point_usage_history
CREATE INDEX "point_usage_history_user_id_created_at_idx" ON "point_usage_history"("user_id", "created_at");
CREATE INDEX "point_usage_history_user_id_usage_type_idx" ON "point_usage_history"("user_id", "usage_type");

-- Migrate existing points to point_transactions
-- Note: Existing points will be treated as never-expiring (set expiration far in future)
-- Free points
INSERT INTO "point_transactions" ("user_id", "type", "amount", "balance", "source", "description", "acquired_at", "expires_at")
SELECT 
  "user_id",
  'free',
  "free_points",
  "free_points",
  'migration',
  'Migrated from existing free_points',
  COALESCE("lastAttendedAt", NOW()),
  COALESCE("freePointsExpiresAt", NOW() + INTERVAL '10 years')
FROM "points"
WHERE "free_points" > 0;

-- Paid points
INSERT INTO "point_transactions" ("user_id", "type", "amount", "balance", "source", "description", "acquired_at", "expires_at")
SELECT 
  "user_id",
  'paid',
  "paid_points",
  "paid_points",
  'migration',
  'Migrated from existing paid_points',
  NOW(),
  COALESCE("paidPointsExpiresAt", NOW() + INTERVAL '10 years')
FROM "points"
WHERE "paid_points" > 0;

