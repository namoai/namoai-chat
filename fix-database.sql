-- Accountテーブルのシーケンスをリセット
SELECT setval(pg_get_serial_sequence('"Account"', 'id'), COALESCE((SELECT MAX(id) FROM "Account"), 0) + 1, false);

-- admin@admin.co.jp のメール認証を完了
UPDATE users SET "emailVerified" = NOW() WHERE email = 'admin@admin.co.jp';

-- 確認
SELECT id, email, role, "emailVerified" FROM users WHERE email IN ('admin@admin.co.jp', 'namoai.namos@gmail.com', 'sc9985@naver.com');


