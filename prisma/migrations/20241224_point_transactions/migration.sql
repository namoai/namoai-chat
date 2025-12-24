-- Create point transactions table for batch management
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
    CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create point usage history table
CREATE TABLE "point_usage_history" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "points_used" INTEGER NOT NULL,
    "usage_type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "related_chat_id" INTEGER,
    "related_message_id" INTEGER,
    "transaction_details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "point_usage_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX "point_transactions_user_id_balance_idx" ON "point_transactions"("user_id", "balance");
CREATE INDEX "point_transactions_user_id_expires_at_idx" ON "point_transactions"("user_id", "expires_at");
CREATE INDEX "point_transactions_user_id_type_idx" ON "point_transactions"("user_id", "type");
CREATE INDEX "point_transactions_expires_at_idx" ON "point_transactions"("expires_at");

CREATE INDEX "point_usage_history_user_id_created_at_idx" ON "point_usage_history"("user_id", "created_at");
CREATE INDEX "point_usage_history_usage_type_idx" ON "point_usage_history"("usage_type");
CREATE INDEX "point_usage_history_related_chat_id_idx" ON "point_usage_history"("related_chat_id");

