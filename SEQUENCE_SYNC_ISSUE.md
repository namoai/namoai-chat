# PostgreSQL シーケンス同期問題と対応

## 問題の概要

### 何が起きていたか

PostgreSQLの自動インクリメント（`SERIAL`型）を使用しているテーブルで、以下のエラーが発生していました：

```
Unique constraint failed on the fields: (id)
```

### 原因

PostgreSQLのシーケンス（例: `characters_id_seq`）が、実際のテーブルの最大IDと同期していない状態でした。

**よくある発生パターン：**
- データベースに直接データをインポートした場合
- `INSERT`文で明示的にIDを指定した場合
- シーケンスを手動でリセットした場合

**例：**
- テーブルの最大ID: `100`
- シーケンスの現在値: `50`
- 次に挿入しようとするID: `51` → **既に存在するためエラー**

## 対応方法

### 自動修正機能の実装

`src/lib/sequence-sync.ts` に以下の機能を実装しました：

1. **`withSequenceSync`**: 単一操作でのシーケンス同期
2. **`withSequenceSyncInTransaction`: トランザクション内でのシーケンス同期

### 動作の流れ

```
1. データ作成を試行
   ↓
2. Unique constraint エラー（P2002）が発生
   ↓
3. エラーがidフィールドに関するものか確認
   ↓
4. テーブルの最大IDを取得
   ↓
5. シーケンスを最大ID+1に設定
   ↓
6. 操作を再試行
```

### 適用箇所

以下のテーブルで自動修正が有効になっています：

- `characters` - キャラクター作成時
- `character_images` - キャラクター画像登録時
- `notifications` - 通知作成時

## 今後の対応

### 自動修正が有効な場合

**何もしなくてOKです。** エラーが発生しても自動的に修正されます。

### 手動で修正が必要な場合

以下のAPIエンドポイントを使用できます：

```
POST /api/admin/fix-sequence
```

**必要な権限:** 管理者（`ADMIN`ロール）

**修正対象テーブル:**
- `characters`
- `character_images`
- `notifications`
- `lorebooks`
- `detailed_memories`

### 予防策

1. **データインポート時**: インポート後にシーケンスを手動で修正
2. **直接SQL実行時**: IDを明示的に指定した場合は、シーケンスも更新
3. **定期的な確認**: 管理者が `/api/admin/fix-sequence` を実行して確認

## 技術的な詳細

### シーケンス修正SQL

```sql
SELECT setval('{table_name}_id_seq', (SELECT MAX(id) FROM {table_name}) + 1, false);
```

### エラーコード

- `P2002`: PrismaのUnique constraint エラー
- エラーメッセージに `Unique constraint failed on the fields: (id)` が含まれる場合に自動修正

### トランザクション内での処理

トランザクションがアボートされた場合、トランザクション外でシーケンスを修正してから、新しいトランザクションで再試行します。

## まとめ

- **問題**: シーケンスとテーブルの最大IDが不一致
- **対応**: 自動修正機能を実装（`src/lib/sequence-sync.ts`）
- **今後の対応**: 基本的に自動修正されるが、必要に応じて手動APIを使用可能

