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

### ✅ 環境分離が必要な場合

1. **データベース分離が必要**
   - 各環境ごとに独立したデータベースが必要な場合
   - テストデータがプロダクションに影響を与えてはいけない場合

2. **外部サービスAPIキーの分離**
   - テスト用とプロダクション用のAPIキーが異なる場合
   - コスト管理が必要な場合（テスト環境では無料/低価格プランを使用）

3. **デバッグおよびログレベルの違い**
   - ローカル/統合テストでは詳細なログが必要
   - ステージング/プロダクションではセキュリティのため最小限のログのみ

4. **テスト機能の管理**
   - テスト専用機能をプロダクションに公開してはいけない場合
   - 開発者ツールやデバッグ機能の制御

5. **パフォーマンスモニタリングの分離**
   - 各環境ごとに別々のモニタリングが必要な場合

### ❌ 環境分離が不要な場合

1. **小規模プロジェクト**
   - 開発者が1-2名の場合
   - 迅速なプロトタイピング段階

2. **シンプルなアプリケーション**
   - 外部サービス依存が少ない場合
   - データベースがシンプルな場合

3. **コスト制約**
   - 追加環境構築コストが負担になる場合

## 推奨事項

### 最小構成（推奨）
- **ローカル環境**: 開発者がローカルでテスト
- **ステージング環境**: プロダクション配信前の検証

### 完全な構成（大規模プロジェクト）
- **ローカル環境**: 開発者ローカルテスト
- **統合テスト環境**: CI/CDパイプラインで自動テスト
- **ステージング環境**: 手動QAおよびクライアント検証
- **プロダクション環境**: 実際のサービス

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

