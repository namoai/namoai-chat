# ポイントシステム変更内容

## 変更日時
2024年12月24日

## 主な変更内容

### 1. 管理パネルメニュー権限バグ修正 ✅
**問題**: 一般ユーザーでも管理パネルメニューが表示される
**原因**: `isAdmin = userRole && userRole !== 'USER'` の条件式で、userRoleがundefinedの時もtrueになる
**修正**: 明示的に管理者ロールをチェックするように変更
```typescript
// 修正前
const isAdmin = userRole && userRole !== 'USER';

// 修正後
const isAdmin = userRole === 'MODERATOR' || userRole === 'CHAR_MANAGER' || userRole === 'SUPER_ADMIN';
```

### 2. ポイント価格の変更 ✅
**新価格設定**: 10,000円 = 30,000ポイント基準

| 金額 | ポイント | 変更前 |
|------|---------|--------|
| 1,100円 | 3,300ポイント | 100ポイント |
| 2,200円 | 6,600ポイント | 250ポイント |
| 5,500円 | 16,500ポイント | 700ポイント |
| 10,000円 | 30,000ポイント | 1,500ポイント |

**1ポイントあたりの価格**: 約0.33円

### 3. ポイント消費量の変更 ✅

#### チャット機能
- **変更前**: 1ポイント/チャット
- **変更後**: 5ポイント/チャット
- **影響ファイル**: 
  - `src/app/api/chat/[chatId]/route.ts`
  - `src/app/api/chat/messages/route.ts`

#### 画像生成機能
- **変更前**: 1ポイント/枚
- **変更後**: 5ポイント/枚
- **影響ファイル**: `src/app/api/images/generate/route.ts`

#### ブースト機能のコスト調整
- **変更前**: 1.5x=1pt, 3.0x=2pt, 5.0x=4pt
- **変更後**: 1.5x=5pt, 3.0x=10pt, 5.0x=20pt

### 4. ポイント有効期限の追加 ✅
**新機能**: すべてのポイントに1年間の有効期限を設定

#### データベーススキーマ変更
```sql
ALTER TABLE "points" ADD COLUMN "freePointsExpiresAt" TIMESTAMPTZ;
ALTER TABLE "points" ADD COLUMN "paidPointsExpiresAt" TIMESTAMPTZ;
```

#### 適用箇所
- **無料ポイント**: 出席チェック時に1年後の有効期限を設定
- **有料ポイント**: 購入時に1年後の有効期限を設定

## 実装されたファイル

### 修正ファイル
1. `src/app/MyPage/page.tsx` - 管理パネルメニュー権限修正
2. `src/app/points/page.tsx` - ポイント価格とヘルプテキスト更新
3. `src/app/api/chat/[chatId]/route.ts` - チャットポイント消費を5に変更
4. `src/app/api/chat/messages/route.ts` - チャットポイント消費を5に変更
5. `src/app/api/images/generate/route.ts` - 画像生成ポイント消費を5に変更
6. `src/app/api/points/route.ts` - 出席チェック時に有効期限設定
7. `src/app/api/stripe/webhook/route.ts` - 購入時に有効期限設定
8. `prisma/schema.prisma` - ポイント有効期限フィールド追加

### 新規作成ファイル
1. `prisma/migrations/20241224_add_point_expiration/migration.sql` - マイグレーションファイル

## マイグレーション実行手順

### 1. データベースマイグレーション
```bash
# Prismaクライアント再生成
npx prisma generate

# マイグレーション実行
npx prisma migrate dev --name add_point_expiration

# または本番環境の場合
npx prisma migrate deploy
```

### 2. 既存ユーザーのポイント有効期限設定（オプション）
既存のポイントに有効期限を設定する場合は、以下のSQLを実行:

```sql
-- 既存の無料ポイントに1年後の有効期限を設定
UPDATE points 
SET "freePointsExpiresAt" = NOW() + INTERVAL '1 year'
WHERE free_points > 0 AND "freePointsExpiresAt" IS NULL;

-- 既存の有料ポイントに1年後の有効期限を設定
UPDATE points 
SET "paidPointsExpiresAt" = NOW() + INTERVAL '1 year'
WHERE paid_points > 0 AND "paidPointsExpiresAt" IS NULL;
```

## 注意事項

### ユーザーへの影響
1. **既存ポイントの価値**: 既存ユーザーが保有しているポイントの価値が5倍になります
   - 例: 100ポイント保有 → 従来100回チャット可能 → 変更後20回チャット可能
   
2. **価格変更**: ポイント購入価格が大幅に変更されています
   - 1,100円: 100pt → 3,300pt (33倍)
   - 実質的にポイント単価が約1/6.6になります

3. **有効期限**: 新規に付与されるポイントには1年間の有効期限が設定されます

### 推奨事項
1. ユーザーへの事前告知を実施
2. 既存ポイント保有者への補償を検討
3. ポイント有効期限の通知機能を実装（将来的に）

## テスト項目

- [ ] 管理パネルメニューが一般ユーザーに表示されないことを確認
- [ ] 管理者ユーザーに管理パネルメニューが表示されることを確認
- [ ] チャット実行時に5ポイント消費されることを確認
- [ ] 画像生成時に5ポイント消費されることを確認
- [ ] 出席チェック時に有効期限が設定されることを確認
- [ ] ポイント購入時に有効期限が設定されることを確認
- [ ] ポイントページで新価格が表示されることを確認
- [ ] ヘルプテキストが更新されていることを確認

## ロールバック手順

変更を元に戻す必要がある場合:

1. Gitで変更をrevert
2. データベースマイグレーションをロールバック:
```bash
npx prisma migrate resolve --rolled-back 20241224_add_point_expiration
```

3. 必要に応じてポイント消費量を元に戻すマイグレーションを実行


