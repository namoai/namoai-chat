-- Add referral system fields to users table
ALTER TABLE "users" ADD COLUMN "referralCode" VARCHAR(10) UNIQUE;
ALTER TABLE "users" ADD COLUMN "referredByUserId" INTEGER;

-- Add foreign key for referral relationship
ALTER TABLE "users" ADD CONSTRAINT "users_referredByUserId_fkey" 
  FOREIGN KEY ("referredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create referral_rewards table
CREATE TABLE "referral_rewards" (
  "id" SERIAL PRIMARY KEY,
  "referrer_user_id" INTEGER NOT NULL,
  "referred_user_id" INTEGER NOT NULL,
  "points_awarded" INTEGER NOT NULL,
  "payment_id" INTEGER,
  "rewarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_rewards_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "referral_rewards_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "referral_rewards_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create unique constraint (each referred user can only generate one reward)
CREATE UNIQUE INDEX "referral_rewards_referred_user_id_key" ON "referral_rewards"("referred_user_id");

-- Create indexes for better query performance
CREATE INDEX "referral_rewards_referrer_user_id_idx" ON "referral_rewards"("referrer_user_id");
CREATE INDEX "referral_rewards_referred_user_id_idx" ON "referral_rewards"("referred_user_id");
CREATE INDEX "referral_rewards_rewarded_at_idx" ON "referral_rewards"("rewarded_at");

