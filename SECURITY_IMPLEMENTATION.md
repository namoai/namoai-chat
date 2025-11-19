# セキュリティ強化実装ガイド

このドキュメントでは、実装されたセキュリティ機能の使用方法を説明します。

## Phase 1: 即座に実装された機能

### 1. ロギング＆モニタリング整備

#### 使用方法

```typescript
import { logger } from '@/lib/logger';

// 通常のログ
logger.info('処理が完了しました', { userId: '123' });
logger.warn('警告メッセージ', { metadata: { key: 'value' } });
logger.error('エラーが発生しました', { error: { name: 'Error', message: '...' } });

// アクセスログ（ミドルウェアで自動記録）
// 手動で記録する場合
logger.logAccess(request, 200, userId);

// エラーログ
logger.logError(error, request, userId, { additionalInfo: '...' });

// 異常検知
logger.logSuspiciousActivity('異常なリクエストパターン', request, userId);
logger.logFailedAuth(ip, email);
```

#### 設定

- 開発環境: コンソールに出力
- 本番環境: バッファに保存（外部サービスへの送信は要実装）

### 2. CSRF対策強化

#### サーバー側

```typescript
import { validateCsrfToken, getCsrfTokenFromRequest } from '@/lib/csrf';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  // ミドルウェアで基本的な検証は実施済み
  // 追加の検証が必要な場合
  const token = getCsrfTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
  }
  
  // 処理続行...
}
```

#### クライアント側

```typescript
import { fetchWithCsrf, getCsrfToken } from '@/lib/csrf-client';
import { apiPost, apiGet } from '@/lib/api-client';

// 方法1: fetchWithCsrfを使用
const response = await fetchWithCsrf('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});

// 方法2: api-clientを使用（推奨）
const result = await apiPost('/api/endpoint', data);
```

#### CSRFトークン取得エンドポイント

```
GET /api/csrf-token
```

### 3. 環境変数のセキュリティ向上

#### 使用方法

```typescript
import { SecureEnv, validateRequiredEnvVars } from '@/lib/env-security';

// 安全に環境変数を取得
const secret = SecureEnv.get('NEXTAUTH_SECRET');

// 必須環境変数の検証
validateRequiredEnvVars(['DATABASE_URL', 'NEXTAUTH_SECRET']);

// ログ用にマスク
const masked = SecureEnv.maskForLogging(secret); // "abcd...xyz"
```

#### 起動時の自動検証

`src/instrumentation.ts`で自動的に実行されます。

### 4. セッションセキュリティ強化

#### 実装内容

- `sameSite: 'strict'`に変更（CSRF対策強化）
- `httpOnly: true`（XSS対策）
- `secure: true`（本番環境、HTTPSのみ）
- セッション更新間隔: 24時間

#### 設定場所

`src/lib/nextauth.ts`の`cookies`セクション

### 5. エラーハンドリング改善

#### 使用方法

```typescript
import { handleError, createErrorResponse, ErrorCode, apiErrorHandler } from '@/lib/error-handler';
import { NextRequest, NextResponse } from 'next/server';

// 方法1: try-catchで使用
export async function POST(request: NextRequest) {
  try {
    // 処理...
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, request, userId);
  }
}

// 方法2: ラッパー関数を使用
export const POST = apiErrorHandler(async (request: NextRequest) => {
  // 処理...
  return NextResponse.json({ success: true });
});

// 方法3: 手動でエラーレスポンスを作成
if (!authorized) {
  return createErrorResponse(
    ErrorCode.FORBIDDEN,
    'この操作を実行する権限がありません。',
    403
  );
}
```

#### エラーコード

- `UNAUTHORIZED`: 認証が必要
- `FORBIDDEN`: 権限不足
- `VALIDATION_ERROR`: バリデーションエラー
- `NOT_FOUND`: リソースが見つからない
- `INTERNAL_ERROR`: サーバーエラー
- `CSRF_TOKEN_INVALID`: CSRFトークン無効

## Phase 2: 長期実装（今後実装予定）

### 1. 2要素認証（2FA）

- SMS認証
- アプリ認証（TOTP）
- バックアップコード

### 2. パスワードポリシー強化

- 最小文字数: 12文字
- 文字種の強制（大文字、小文字、数字、記号）
- 定期変更の推奨
- 漏えい時の強制再設定

### 3. API認証強化

- APIキーの発行と権限分離
- トークンの短寿命化（1時間）
- トークンのローテーション

### 4. データ暗号化

- 保存時の暗号化（重要データ）
- 通信時の暗号化（TLS/SSL）
- 鍵管理プロセスの強化

### 5. 定期セキュリティ監査

- コード監査
- インフラ監査
- 権限監査
- 脆弱性スキャン

## 移行ガイド

### 既存のAPIルートを更新

1. **エラーハンドリングを追加**

```typescript
// 変更前
export async function POST(request: Request) {
  try {
    // 処理...
  } catch (error) {
    return NextResponse.json({ error: 'エラー' }, { status: 500 });
  }
}

// 変更後
import { handleError } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  try {
    // 処理...
  } catch (error) {
    return handleError(error, request, userId);
  }
}
```

2. **クライアント側でCSRFトークンを使用**

```typescript
// 変更前
const response = await fetch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});

// 変更後
import { apiPost } from '@/lib/api-client';
const result = await apiPost('/api/endpoint', data);
```

## 注意事項

1. **CSRFトークン**: すべてのPOST/PUT/DELETE/PATCHリクエストに必要
2. **エラーハンドリング**: 内部情報を露出しないよう注意
3. **環境変数**: 本番環境では強力な値を設定
4. **ログ**: 機密情報をログに記録しない

## トラブルシューティング

### CSRFトークンエラー

- クライアント側で`/api/csrf-token`を呼び出してトークンを取得しているか確認
- リクエストヘッダーに`x-csrf-token`が含まれているか確認

### セッションが切れる

- セッションの有効期限を確認（30日間）
- セッション更新間隔を確認（24時間）

### 環境変数エラー

- `src/instrumentation.ts`のログを確認
- 必須環境変数が設定されているか確認

