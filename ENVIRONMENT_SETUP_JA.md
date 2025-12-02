# 環境(Environment)設定ガイド

このプロジェクトは以下の3つの環境をサポートします：

1. **ローカルテスト環境 (local)** - 開発者がローカルでテスト
2. **IT(結合)テスト環境 (integration)** - システム統合および結合テスト
3. **混紡(ステージング)環境 (staging)** - プロダクション配信前の最終検証

## 環境の区別方法

環境は`APP_ENV`環境変数で区別されます：

- `APP_ENV=local` → ローカルテスト環境
- `APP_ENV=integration` → IT(結合)テスト環境
- `APP_ENV=staging` → 混紡(ステージング)環境
- `APP_ENV=production` → プロダクション環境（または`APP_ENV`未設定時、`NODE_ENV=production`の場合は自動）

## 環境別設定

### 1. ローカルテスト環境 (local)

**設定方法：**
```bash
# .env.local
APP_ENV=local
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/namos_chat_local
```

**特徴：**
- ✅ データ変更許可
- ✅ デバッグログ有効化
- ✅ テスト機能有効化
- ✅ 実際のサービス使用（モッキングなし）

**使用シナリオ：**
- 開発者がローカルで機能開発および単体テスト
- 迅速なフィードバックのための開発サイクル

### 2. IT(結合)テスト環境 (integration)

**設定方法：**
```bash
# .env.integration またはデプロイ環境変数
APP_ENV=integration
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://it-test.example.com
NEXT_PUBLIC_IT_API_URL=https://it-test.example.com
IT_DATABASE_URL=postgresql://it-db.example.com:5432/namos_chat_it
```

**特徴：**
- ✅ データ変更許可
- ✅ デバッグログ有効化
- ✅ テスト機能有効化
- ✅ 実際のサービス使用

**使用シナリオ：**
- システム間統合テスト
- API結合テスト
- E2Eテスト
- 回帰テスト

### 3. 混紡(ステージング)環境 (staging)

**設定方法：**
```bash
# デプロイ環境変数
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://staging.example.com
NEXT_PUBLIC_STAGING_API_URL=https://staging.example.com
STAGING_DATABASE_URL=postgresql://staging-db.example.com:5432/namos_chat_staging
```

**特徴：**
- ✅ データ変更許可
- ❌ デバッグログ無効化
- ❌ テスト機能無効化
- ✅ 実際のサービス使用

**使用シナリオ：**
- プロダクション配信前の最終検証
- クライアント/QAチームの受入テスト
- パフォーマンステスト
- セキュリティ検証

## コードでの環境使用

### 基本使用方法

```typescript
import { 
  getEnvironmentType, 
  getEnvironmentConfig,
  isLocal,
  isIntegration,
  isStaging,
  isProduction,
  shouldEnableDebugLogs,
  shouldEnableTestFeatures,
  allowMutations
} from '@/lib/environment';

// 現在の環境タイプを確認
const envType = getEnvironmentType(); // 'local' | 'integration' | 'staging' | 'production'

// 環境別設定を取得
const config = getEnvironmentConfig();

// 環境別条件分岐
if (isLocal()) {
  console.log('ローカル環境です');
}

if (isIntegration()) {
  console.log('統合テスト環境です');
}

if (isStaging()) {
  console.log('ステージング環境です');
}

// デバッグログの条件付き出力
if (shouldEnableDebugLogs()) {
  console.log('[DEBUG] 詳細なデバッグ情報');
}

// テスト機能の有効化確認
if (shouldEnableTestFeatures()) {
  // テスト専用機能を表示
}
```

### 実際の使用例

```typescript
// APIルートで
import { isLocal, shouldEnableDebugLogs } from '@/lib/environment';

export async function GET() {
  if (shouldEnableDebugLogs()) {
    console.log('[API] GETリクエスト受信');
  }
  
  // ローカル環境でのみ詳細なエラー情報を返す
  try {
    // ... ロジック
  } catch (error) {
    if (isLocal()) {
      return NextResponse.json({ 
        error: error.message,
        stack: error.stack 
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

## IT環境から混紡環境への移行

IT環境で作成されたキャラクターを混紡環境に移行する機能が利用可能です。

### キャラクター作成後の移行

キャラクター作成が成功した後、IT環境では「混紡環境に移行」ボタンが表示されます。このボタンをクリックすると、混紡環境のURLにリダイレクトされます。

```typescript
import { isIntegration, getStagingMigrationUrl } from '@/lib/environment';

// IT環境でキャラクター作成後
if (isIntegration() && characterId) {
  const stagingUrl = getStagingMigrationUrl(characterId);
  // ボタンクリック時に stagingUrl にリダイレクト
}
```

## デプロイ環境別設定

### Netlify

Netlify Dashboard → Site configuration → Environment variables:

**Production (mainブランチ):**
```
APP_ENV=production
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://example.com
```

**Deploy Preview (PRブランチ):**
```
APP_ENV=integration
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://it-test.example.com
```

**Branch Deploy (developブランチなど):**
```
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://staging.example.com
```

### AWS Amplify

Amplify Console → App settings → Environment variables:

**Productionブランチ:**
```
APP_ENV=production
NODE_ENV=production
```

**Stagingブランチ:**
```
APP_ENV=staging
NODE_ENV=production
```

**Integrationブランチ:**
```
APP_ENV=integration
NODE_ENV=production
```

## 環境分離の必要性

### 📋 概要

プロジェクトは**ローカルテスト環境**と**ITテスト環境**を区別して使用します。各環境の目的とコストを理解し、チームの状況に合わせて選択してください。

---

### 🎯 要点

#### ローカルテスト環境
- **必要性**: 開発者が各自のコンピューターで迅速にテスト
- **コスト**: 追加コストなし（ローカルDB使用）
- **用途**: 単体テスト、迅速なフィードバック、個人開発

#### ITテスト環境
- **必要性の判断基準**:
  - チーム規模: 開発者3名以上、CI/CDパイプライン使用時推奨
  - 統合テスト: 複数システム間の統合検証が必要な場合
  - 本番環境の安定性: デプロイ前に実際の環境と同様の検証が必要な場合
- **コスト**: 必要な時のみ実行時 **約500-1,000円/月**、24時間実行時 **約3,275円/月**

---

### 📊 詳細

#### 1. ローカルテスト環境 vs ITテスト環境

| 項目 | ローカルテスト環境 | ITテスト環境 |
|------|----------------|---------------|
| **場所** | 各開発者のコンピューター | AWS RDS（クラウド） |
| **コスト** | 0円/月 | 500-3,275円/月 |
| **速度** | 非常に高速 | 普通（ネットワーク遅延） |
| **独立性** | 各自独立 | チーム共有 |
| **統合テスト** | 困難 | 可能 |
| **CI/CD連携** | 困難 | 可能 |

#### 2. ITテスト環境のコスト（円建て）

**環境仕様:**
- インスタンス: PostgreSQL db.t3.micro
- リージョン: ap-northeast-1c（東京）
- デプロイ: Single-AZ（Multi-AZではない）

**月額コスト計算（24時間実行時）:**
- DBインスタンス: 0.026 USD/時間 × 24時間 × 30日 = 18.72 USD
- ストレージ（20GB）: 20GB × 0.115 USD/GB = 2.3 USD
- バックアップストレージ（20GB）: 20GB × 0.095 USD/GB = 1.9 USD
- データ転送（10GB）: 最初の1GB無料 + 9GB × 0.09 USD = 0.81 USD
- **合計月額コスト: 約23.73 USD ≈ 3,560円/月**

**コスト削減方法:**
- **核心**: 必要な時のみ実行し、終わったら停止！
- AWS CLIで停止/開始:
  ```bash
  # 停止（コスト削減）
  aws rds stop-db-instance --db-instance-identifier namos-chat-it
  
  # 開始（約5-10分かかります）
  aws rds start-db-instance --db-instance-identifier namos-chat-it
  ```
- シナリオ別コスト:
  - 月40時間使用: 約500円/月（推奨）
  - 週5日、1日8時間: 約969円/月
  - 24時間継続実行: 約3,153円/月（非推奨）

**AWS無料利用枠:**
- 新規アカウントは12ヶ月間 db.t3.micro 750時間/月 + 20GBストレージ無料
- 無料利用枠適用時: 月0円（750時間以内）

#### 3. 環境間のデータ移動

**IT環境 → ステージング/本番環境:**

キャラクターデータをIT環境からステージングまたは本番環境に移動する方法:

1. **APIによるキャラクターExport/Import**
   - IT環境でキャラクターデータをJSONでExport
   - ステージング/本番環境でImport
   - APIエンドポイント: `/api/characters/[id]/import`

2. **データベース直接マイグレーション**
   - `pg_dump`でIT環境DBをバックアップ
   - `pg_restore`でステージング/本番環境に復元
   - 注意: ユーザーデータは除外し、キャラクターデータのみ移動を推奨

3. **手動コピー**
   - IT環境でキャラクター情報を確認
   - ステージング/本番環境で同様に再作成

**注意事項:**
- IT環境のテストデータは本番環境に直接移動しないこと
- 必ずステージング環境でまず検証してから本番環境に移動
- ユーザーデータ、チャット記録などは環境別に分離維持

---

### ✅ 結論

#### ITテスト環境が必要な場合
- 開発者3名以上
- CI/CD自動化テストが必要
- 統合テスト必須
- 本番環境の安定性を重視

#### ITテスト環境が不要な場合
- 開発者1-2名
- 小規模プロジェクト
- コスト制約
- ローカル + ステージングで十分

#### 推奨事項

**最小構成（小規模チーム）:**
- ローカル環境: 開発者がローカルでテスト
- ステージング環境: 本番デプロイ前の検証
- **コスト**: IT環境なし → 0円/月

**完全な構成（大規模チーム）:**
- ローカル環境: 開発者ローカルテスト
- ITテスト環境: CI/CDパイプラインで自動テスト
- ステージング環境: 手動QAおよびクライアント検証
- 本番環境: 実際のサービス
- **コスト**: IT環境必要な時のみ実行 → 約500-1,000円/月

#### コスト要約
- ITテスト環境（RDS db.t3.micro、必要な時のみ実行）: 約500-1,000円/月
- ITテスト環境（24時間実行）: 約3,275円/月
- 無料利用枠適用時: 0円/月（12ヶ月間、750時間以内）

#### 💡 IT環境の実行方法

**管理パネルからの制御:**

**SUPER_ADMIN**権限を持つユーザーは、管理パネルからIT環境を開始/停止できます。

1. **管理パネルにアクセス**
   - `/admin`ページに移動
   - SUPER_ADMIN権限が必要

2. **IT環境管理カードをクリック**
   - 「ITテスト環境管理」カードをクリック
   - `/admin/it-environment`ページに移動

3. **IT環境の制御**
   - 現在の状態を確認（実行中/停止中）
   - **開始ボタン**: IT環境データベースを開始（約5-10分かかります）
   - **停止ボタン**: IT環境データベースを停止（コスト削減）

**環境変数設定:**

`.env.local`またはデプロイ環境に以下の変数を追加してください:

```bash
# IT環境RDSインスタンス識別子（デフォルト: namos-chat-it）
IT_RDS_INSTANCE_IDENTIFIER=namos-chat-it

# AWSリージョン（デフォルト: ap-northeast-1）
AWS_REGION=ap-northeast-1

# AWS認証情報（IAMロールまたは環境変数）
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

**注意事項:**
1. **AWS権限**: RDSインスタンスを開始/停止するには適切なIAM権限が必要です
2. **インスタンス識別子**: `IT_RDS_INSTANCE_IDENTIFIER`環境変数でインスタンス名を指定できます
3. **コスト削減**: 使用しない時は停止してコストを削減してください

## マイグレーションガイド

既存のコードを環境分離システムにマイグレーション：

1. `APP_ENV`環境変数を追加
2. `src/lib/environment.ts`のユーティリティ関数を使用
3. ハードコードされた`NODE_ENV`チェックを環境タイプチェックに変更
4. 各環境別の環境変数設定

```typescript
// Before
if (process.env.NODE_ENV === 'development') {
  // ...
}

// After
import { isLocal, shouldEnableDebugLogs } from '@/lib/environment';
if (isLocal() || shouldEnableDebugLogs()) {
  // ...
}
```

