# ポイントシステム V2 変更内容

## 変更日時
2024年12月24日 (追加実装)

## 概要
ポイントの有効期限をバッチ別に管理し、FIFO方式で消費する新しいシステムに全面刷新しました。

## 主な変更内容

### 1. ポイントバッチ管理システム導入 ✅

#### 新しいテーブル構造

**`point_transactions` (ポイント取引履歴)**
- 各ポイント取得を個別のバッチとして記録
- 各バッチごとに独立した有効期限を設定
- フィールド:
  - `balance`: このバッチの残高（消費されるたびに減少）
  - `acquired_at`: 取得日時
  - `expires_at`: 有効期限（取得日から1年後）
  - `source`: 取得元（attendance, purchase, admin_grant, migration）

**`point_usage_history` (ポイント使用履歴)**
- ポイント消費の詳細を記録
- どのバッチからいくら消費したかをJSON形式で保存
- フィールド:
  - `points_used`: 使用したポイント数
  - `usage_type`: 使用タイプ（chat, image_generation, boost）
  - `transaction_details`: 消費詳細（JSON）
  - `related_chat_id`, `related_message_id`: 関連情報

### 2. FIFO (先入先出) 消費ロジック ✅

ポイント消費の優先順位:
1. **無料ポイント** → 有料ポイント
2. **有効期限が近い** → 遠い
3. **取得日時が古い** → 新しい

```typescript
// 消費順序の例
const batches = await findMany({
  where: {
    balance: { gt: 0 },
    expires_at: { gt: now },
  },
  orderBy: [
    { type: 'desc' }, // free が先
    { acquired_at: 'asc' }, // 古い順
  ],
});
```

### 3. 有効期限管理 ✅

- **取得時**: 全ポイントに1年の有効期限を自動設定
- **消費時**: 有効期限切れのポイントは自動的にスキップ
- **削除時**: Cron jobで期限切れポイントを定期的にクリーンアップ

### 4. 新しいAPI エンドポイント ✅

#### `/api/points/history`
- ポイント取得・使用履歴を取得
- パラメータ: `type` ('earn', 'spend', 'all')
- レスポンス: 統合された履歴データ

#### `/api/points/balance`
- 詳細なポイント残高を取得
- 各バッチの残高と有効期限を含む
- レスポンス:
  ```json
  {
    "totalFreePoints": 100,
    "totalPaidPoints": 500,
    "totalPoints": 600,
    "details": [
      {
        "id": 1,
        "type": "free",
        "balance": 100,
        "expiresAt": "2025-12-24T00:00:00Z",
        "source": "attendance"
      }
    ]
  }
  ```

#### `/api/cron/cleanup-expired-points`
- 有効期限切れポイントを自動削除するCron job
- 認証: `Authorization: Bearer CRON_SECRET`
- 推奨実行頻度: 毎日1回

### 5. 新しいUI ページ ✅

#### `/points/history`
ポイント履歴ページの機能:
- 取得・使用履歴の表示
- 有効期限別の残高表示
- 有効期限が30日以内のポイントに警告表示
- フィルタリング機能（全て/取得/使用）
- リアルタイム残高表示

### 6. ポイントマネージャーライブラリ ✅

**`src/lib/point-manager.ts`**

主な関数:
- `grantPoints()`: ポイント付与
- `consumePoints()`: ポイント消費（FIFO）
- `getPointBalance()`: 残高取得
- `cleanupExpiredPoints()`: 期限切れポイント削除

使用例:
```typescript
// ポイント付与
await grantPoints({
  userId: 123,
  amount: 30,
  type: 'free',
  source: 'attendance',
  description: '出席チェック',
});

// ポイント消費
await consumePoints({
  userId: 123,
  amount: 5,
  usageType: 'chat',
  description: 'チャット送信',
  relatedChatId: 456,
});
```

## マイグレーション手順

### 1. データベースマイグレーション実行

```bash
# スキーマ更新
npx prisma generate

# マイグレーション実行
npx prisma migrate deploy
```

### 2. 既存ポイントデータ移行

```bash
# 移行スクリプト実行
node scripts/migrate-existing-points.mjs
```

このスクリプトは:
- 既存の `points` テーブルから全ユーザーのポイントを取得
- 各ポイントを `point_transactions` に移行
- データ整合性を検証
- 移行結果をレポート

### 3. Cron Job設定

#### Vercel Cron (推奨)

`vercel.json` に追加:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-expired-points",
      "schedule": "0 3 * * *"
    }
  ]
}
```

環境変数に追加:
```
CRON_SECRET=your-random-secret-here
```

## 互換性

### 既存コードとの互換性
- ✅ `points` テーブルは残存（高速な残高確認用）
- ✅ 既存のポイント確認APIは引き続き動作
- ✅ 段階的な移行が可能

### 後方互換性
1. **残高確認**: `points` テーブルは引き続き更新され、既存APIも動作
2. **トランザクション**: 新しいシステムは並行して記録
3. **移行期間**: 両システムを同時に運用可能

## テスト項目

- [ ] ポイント付与（出席チェック）
- [ ] ポイント付与（購入）
- [ ] ポイント消費（チャット）
- [ ] ポイント消費（画像生成）
- [ ] FIFO消費順序の確認
- [ ] 有効期限切れポイントのスキップ
- [ ] 履歴ページの表示
- [ ] 残高ページの表示
- [ ] 有効期限警告の表示
- [ ] Cron jobの実行
- [ ] データ移行スクリプトの実行

## トラブルシューティング

### ポイント残高が合わない場合

```sql
-- point_transactions の合計を確認
SELECT 
  user_id,
  type,
  SUM(balance) as total_balance
FROM point_transactions
WHERE expires_at > NOW()
GROUP BY user_id, type;

-- points テーブルと比較
SELECT user_id, free_points, paid_points 
FROM points 
WHERE user_id = YOUR_USER_ID;
```

### 期限切れポイントの手動削除

```bash
# APIを直接呼び出し
curl -X GET https://your-domain.com/api/cron/cleanup-expired-points \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## ロールバック手順

万が一、問題が発生した場合:

1. **データベースロールバック**
```bash
npx prisma migrate resolve --rolled-back 20241224_point_transactions
```

2. **ポイント付与ロジック復元**
```bash
git revert HEAD~1
```

3. **再デプロイ**

## 今後の改善案

1. **ポイント有効期限の通知機能**
   - 失効7日前にメール通知
   - マイページに警告バナー表示

2. **ポイント履歴のエクスポート機能**
   - CSV/PDFダウンロード
   - 月次レポート生成

3. **ポイント統計ダッシュボード**
   - 取得・消費の推移グラフ
   - 失効予定ポイントの可視化

4. **ポイントギフト機能**
   - ユーザー間でのポイント譲渡
   - ギフトコード発行

## 参考資料

- [ポイント制度の詳細設計](./ポイント制度_総合資料.md)
- [価格設定の根拠](./ポイント制度_価格設定_修正版.md)
- [Prisma Schema](./prisma/schema.prisma)
- [Point Manager ライブラリ](./src/lib/point-manager.ts)


