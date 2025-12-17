-- Add adult verification fields to users table for legal proof
-- 成人認証関連フィールドを追加（証明文書用）

ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "adultVerificationDate" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "adultVerificationBirthdate" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "adultVerificationAgreed" BOOLEAN;

-- コメント追加（証明文書用であることを明記）
COMMENT ON COLUMN "public"."users"."adultVerificationDate" IS '成人認証実施日時（証明文書用）';
COMMENT ON COLUMN "public"."users"."adultVerificationBirthdate" IS '成人認証時に入力した生年月日（証明文書用）';
COMMENT ON COLUMN "public"."users"."adultVerificationAgreed" IS '成人認証時の同意内容（証明文書用）';

