# Point Transaction System - 完全実装ガイド

## 概要

個別のポイント取得を追跡し、各ポイントバッチごとに独立した有効期限を管理するシステムです。

## 主な機能

### 1. 個別バッチ管理
- 取得したポイントは個別のトランザクションとして記録
- 各トランザクションは独立した有効期限を持つ（取得から1年）
- FIFO（First In First Out）方式で古いポイントから消費

### 2. 完全な履歴追跡
- **取得履歴**: いつ、どこから、どれだけのポイントを取得したか
- **使用履歴**: いつ、何に、どれだけのポイントを使用したか
- 各使用履歴には、どのトランザクションから何ポイント使ったかの詳細を記録

### 3. 自動期限管理
- 期限切れポイントの自動検出
- 30日以内に期限切れになるポイントの警告
- 定期的な期限切れポイントのクリーンアップ

## データベーススキーマ

### point_transactions テーブル
```sql
CREATE TABLE "point_transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" VARCHAR(50) NOT NULL,           -- 'free' or 'paid'
  "amount" INTEGER NOT NULL,              -- 取得した初期ポイント数
  "balance" INTEGER NOT NULL,             -- 現在の残高
  "source" VARCHAR(100) NOT NULL,         -- 'attendance', 'purchase', etc.
  "description" TEXT,                     -- 詳細説明
  "payment_id" INTEGER,                   -- 購入の場合、paymentsテーブルへの参照
  "acquired_at" TIMESTAMPTZ NOT NULL,     -- 取得日時
  "expires_at" TIMESTAMPTZ NOT NULL,      -- 有効期限（取得から1年後）
  "created_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
```

### point_usage_history テーブル
```sql
CREATE TABLE "point_usage_history" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "points_used" INTEGER NOT NULL,
  "usage_type" VARCHAR(50) NOT NULL,      -- 'chat', 'image_generation', etc.
  "description" TEXT,
  "related_chat_id" INTEGER,
  "related_message_id" INTEGER,
  "transaction_details" JSONB,            -- どのトランザクションから何ポイント使ったか
  "created_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "fk_user_usage" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
```

## API エンドポイント

### 1. ポイント履歴取得
```
GET /api/points/history?type=all&limit=50&offset=0
```

**クエリパラメータ:**
- `type`: 'acquired' | 'used' | 'all' (デフォルト: 'all')
- `limit`: 取得件数 (デフォルト: 50)
- `offset`: オフセット (デフォルト: 0)

**レスポンス:**
```json
{
  "balance": {
    "totalFreePoints": 150,
    "totalPaidPoints": 300,
    "totalPoints": 450
  },
  "acquired": [
    {
      "id": 1,
      "type": "free",
      "amount": 30,
      "balance": 15,
      "source": "attendance",
      "description": "出席チェック",
      "acquired_at": "2024-12-24T09:00:00Z",
      "expires_at": "2025-12-24T09:00:00Z",
      "created_at": "2024-12-24T09:00:00Z",
      "isExpired": false,
      "isExpiringSoon": false
    }
  ],
  "used": [
    {
      "id": 1,
      "points_used": 5,
      "usage_type": "chat",
      "description": "チャット送信",
      "related_chat_id": 123,
      "related_message_id": 456,
      "created_at": "2024-12-24T10:00:00Z"
    }
  ],
  "expiringSoon": [
    {
      "id": 2,
      "type": "paid",
      "balance": 100,
      "expires_at": "2025-01-15T00:00:00Z",
      "source": "purchase"
    }
  ]
}
```

### 2. 期限切れポイントのクリーンアップ（Cron用）
```
POST /api/cron/cleanup-expired-points
Authorization: Bearer {CRON_SECRET}
```

## 使用方法

### ポイント付与
```typescript
import { grantPoints } from '@/lib/point-manager';

await grantPoints({
  userId: 1,
  amount: 30,
  type: 'free',
  source: 'attendance',
  description: '出席チェック',
});
```

### ポイント消費
```typescript
import { consumePoints } from '@/lib/point-manager';

await consumePoints({
  userId: 1,
  amount: 5,
  usageType: 'chat',
  description: 'チャット送信',
  relatedChatId: 123,
  relatedMessageId: 456,
});
```

### ポイント残高確認
```typescript
import { getPointBalance } from '@/lib/point-manager';

const balance = await getPointBalance(1);
console.log(balance.totalPoints); // 450
console.log(balance.details);     // 個別トランザクションの詳細
```

### 期限切れポイントのクリーンアップ
```typescript
import { cleanupExpiredPoints } from '@/lib/point-manager';

const result = await cleanupExpiredPoints();
console.log(`Cleaned ${result.cleanedCount} transactions`);
console.log(`Total ${result.totalPointsCleaned} points removed`);
```

## 定期実行設定

### GitHub Actionsでの自動実行
`.github/workflows/cleanup-expired-points.yml` が設定済み
- 毎日 3:00 AM JST に自動実行
- 手動実行も可能

### 環境変数
```env
CRON_SECRET=your-secure-random-string
```

### 手動実行
```bash
node scripts/cleanup-expired-points.mjs
```

## マイグレーション

### 既存データの移行
マイグレーションスクリプトは既存のポイントを自動的に `point_transactions` に移行します：
- 既存の無料ポイントは有効期限10年として移行
- 既存の有料ポイントは有効期限10年として移行
- 新規取得ポイントは取得から1年の有効期限が設定される

### 実行方法
```bash
npx prisma migrate dev --name point_transaction_system
# または本番環境
npx prisma migrate deploy
```

## UIページ

### ポイント履歴ページ
- URL: `/points/history`
- 機能:
  - 取得履歴と使用履歴の切り替え表示
  - 現在の残高表示
  - 期限切れ間近のポイント警告
  - 各ポイントの有効期限表示

### ポイントページへのリンク追加
`/points` ページに「履歴」ボタンが追加されました

## テスト項目

- [ ] ポイント付与時に正しくトランザクションが作成される
- [ ] ポイント消費時にFIFO順で消費される
- [ ] 無料ポイントが有料ポイントより先に消費される
- [ ] 期限切れポイントは消費対象にならない
- [ ] ポイント残高が正確に計算される
- [ ] 履歴APIが正しいデータを返す
- [ ] 期限切れポイントのクリーンアップが正常に動作する
- [ ] UIで履歴が正しく表示される
- [ ] 期限切れ間近の警告が表示される

## トラブルシューティング

### ポイント残高が合わない
1. `point_transactions` テーブルの `balance` を確認
2. 期限切れポイントが含まれていないか確認
3. `points` テーブルと `point_transactions` の合計を比較

### マイグレーションエラー
1. 既存のポイントデータを確認
2. トランザクション実行中のエラーログを確認
3. 必要に応じて手動でデータ修正

### パフォーマンス問題
1. インデックスが正しく作成されているか確認
2. 期限切れポイントが蓄積していないか確認
3. クリーンアップジョブが正常に実行されているか確認

## 今後の改善案

- [ ] ポイント返金機能（画像生成失敗時など）
- [ ] ポイント有効期限の延長機能
- [ ] 管理者によるポイント調整機能
- [ ] ポイント取引のエクスポート機能
- [ ] 月次/年次のポイント使用統計
- [ ] ポイント残高のリアルタイム通知

