-- 既存の admin@admin.co.jp を管理者に設定（必要な場合）
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@admin.co.jp';

-- sc9985@naver.com を管理者に設定（必要な場合）
UPDATE users SET role = 'ADMIN' WHERE email = 'sc9985@naver.com';

-- namoai.namos@gmail.com を管理者に設定（必要な場合）
UPDATE users SET role = 'ADMIN' WHERE email = 'namoai.namos@gmail.com';

-- 確認
SELECT id, email, role, "emailVerified" FROM users WHERE email IN ('admin@admin.co.jp', 'sc9985@naver.com', 'namoai.namos@gmail.com');


