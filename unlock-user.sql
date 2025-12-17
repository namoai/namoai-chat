-- ユーザーアカウントのロックを解除
-- Unlock user account

-- admin@admin.co.jp のロックを解除
UPDATE users 
SET 
  "lockedUntil" = NULL,
  "loginAttempts" = 0
WHERE email = 'admin@admin.co.jp';

-- 確認
SELECT id, email, "loginAttempts", "lockedUntil" 
FROM users 
WHERE email = 'admin@admin.co.jp';

