# データベースマイグレーションガイド

## メモリシステムのマイグレーション

新しいメモリシステム（バックメモリと詳細記憶）を追加するために、データベースマイグレーションを実行する必要があります。

### マイグレーションファイル

`prisma/migrations/add_memory_system.sql` ファイルを確認してください。

### マイグレーションの実行方法

#### 方法1: Prisma Migrate を使用（推奨）

```bash
npx prisma migrate dev --name add_memory_system
```

#### 方法2: SQLファイルを直接実行

PostgreSQLデータベースに接続して、以下のSQLを実行してください：

```sql
-- chatテーブルにカラムを追加
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "backMemory" TEXT;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "backMemoryEmbedding" vector;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "autoSummarize" BOOLEAN DEFAULT true;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS "chat_backMemoryEmbedding_idx" ON "chat" USING ivfflat ("backMemoryEmbedding" vector_cosine_ops);

-- chat_messageテーブルにembeddingカラムを追加
ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "embedding" vector;
CREATE INDEX IF NOT EXISTS "chat_message_embedding_idx" ON "chat_message" USING ivfflat ("embedding" vector_cosine_ops);

-- detailed_memoriesテーブルを作成
CREATE TABLE IF NOT EXISTS "detailed_memories" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[],
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastApplied" TIMESTAMP(3),
    CONSTRAINT "detailed_memories_pkey" PRIMARY KEY ("id")
);

-- 外部キー制約を追加
ALTER TABLE "detailed_memories" ADD CONSTRAINT "detailed_memories_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- インデックスを作成
CREATE INDEX IF NOT EXISTS "detailed_memories_chatId_createdAt_idx" ON "detailed_memories"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "detailed_memories_embedding_idx" ON "detailed_memories" USING ivfflat ("embedding" vector_cosine_ops);
```

### 注意事項

- pgvector拡張機能がインストールされていることを確認してください
- ベクトルインデックス（ivfflat）を作成するには、pgvector拡張機能が必要です
- プロダクション環境では、バックアップを取ってから実行してください

### マイグレーション後の確認

マイグレーションが正常に完了したら、以下のコマンドでPrisma Clientを再生成してください：

```bash
npx prisma generate
```

