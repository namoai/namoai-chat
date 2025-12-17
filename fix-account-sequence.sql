-- Account テーブルのシーケンスをリセット
SELECT setval(pg_get_serial_sequence('"Account"', 'id'), COALESCE(MAX(id), 1)) FROM "Account";

-- または、すべてのAccountレコードを削除してからリセット（開発環境のみ）
-- DELETE FROM "Account";
-- ALTER SEQUENCE "Account_id_seq" RESTART WITH 1;


