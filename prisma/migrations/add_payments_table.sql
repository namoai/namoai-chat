-- CreateTable
CREATE TABLE IF NOT EXISTS "payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stripe_payment_id" TEXT,
    "stripe_session_id" TEXT,
    "amount" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency" TEXT NOT NULL DEFAULT 'jpy',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_stripe_payment_id_key" ON "payments"("stripe_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_stripe_session_id_key" ON "payments"("stripe_session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_stripe_payment_id_idx" ON "payments"("stripe_payment_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_stripe_session_id_idx" ON "payments"("stripe_session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments"("created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;




















