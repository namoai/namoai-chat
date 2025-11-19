# クライアント側セキュリティ実装ガイド

## CSRFトークンの使用

### 基本的な使用方法

既存の`fetch`呼び出しを`api-client`の関数に置き換えてください。

#### 変更前

```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
  credentials: 'include',
});

const result = await response.json();
```

#### 変更後

```typescript
import { apiPost } from '@/lib/api-client';

try {
  const result = await apiPost('/api/endpoint', data);
  // 成功時の処理
} catch (error) {
  if (error instanceof ApiErrorResponse) {
    // エラーハンドリング
    console.error(error.code, error.message);
  }
}
```

### 利用可能な関数

```typescript
import { apiGet, apiPost, apiPut, apiDelete, ApiErrorResponse } from '@/lib/api-client';

// GETリクエスト
const data = await apiGet('/api/endpoint');

// POSTリクエスト
const result = await apiPost('/api/endpoint', { key: 'value' });

// PUTリクエスト
const updated = await apiPut('/api/endpoint/123', { key: 'newValue' });

// DELETEリクエスト
await apiDelete('/api/endpoint/123');
```

### エラーハンドリング

```typescript
import { apiPost, ApiErrorResponse } from '@/lib/api-client';
import { ErrorCode } from '@/lib/error-handler';

try {
  const result = await apiPost('/api/endpoint', data);
} catch (error) {
  if (error instanceof ApiErrorResponse) {
    switch (error.code) {
      case ErrorCode.UNAUTHORIZED:
        // 認証が必要
        router.push('/login');
        break;
      case ErrorCode.FORBIDDEN:
        // 権限不足
        alert('この操作を実行する権限がありません。');
        break;
      case ErrorCode.VALIDATION_ERROR:
        // バリデーションエラー
        alert(error.message);
        break;
      case ErrorCode.CSRF_TOKEN_INVALID:
        // CSRFトークンエラー（自動的に再取得を試みる）
        console.error('CSRF token invalid, retrying...');
        // api-clientが自動的に再試行する場合があります
        break;
      default:
        // その他のエラー
        alert('エラーが発生しました: ' + error.message);
    }
  } else {
    // ネットワークエラーなど
    alert('ネットワークエラーが発生しました。');
  }
}
```

### 手動でCSRFトークンを管理する場合

```typescript
import { getCsrfToken, fetchWithCsrf } from '@/lib/csrf-client';

// トークンを取得
const token = await getCsrfToken();

// fetchWithCsrfを使用
const response = await fetchWithCsrf('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});

// ログアウト時などにトークンをリセット
import { resetCsrfToken } from '@/lib/csrf-client';
resetCsrfToken();
```

## 実装例

### Reactコンポーネントでの使用

```typescript
'use client';

import { useState } from 'react';
import { apiPost, ApiErrorResponse } from '@/lib/api-client';
import { ErrorCode } from '@/lib/error-handler';

export default function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiPost('/api/endpoint', data);
      // 成功時の処理
      console.log('Success:', result);
    } catch (err) {
      if (err instanceof ApiErrorResponse) {
        if (err.code === ErrorCode.UNAUTHORIZED) {
          // ログインページにリダイレクト
          window.location.href = '/login';
        } else {
          setError(err.message);
        }
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={() => handleSubmit(formData)} disabled={loading}>
        {loading ? '送信中...' : '送信'}
      </button>
    </div>
  );
}
```

### フォーム送信での使用

```typescript
'use client';

import { FormEvent } from 'react';
import { apiPost } from '@/lib/api-client';

export default function MyForm() {
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const result = await apiPost('/api/endpoint', data);
      alert('送信成功！');
    } catch (error) {
      alert('送信に失敗しました。');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="field1" />
      <button type="submit">送信</button>
    </form>
  );
}
```

## 注意事項

1. **すべてのPOST/PUT/DELETE/PATCHリクエスト**で`api-client`の関数を使用してください。

2. **GETリクエスト**はCSRF保護の対象外ですが、統一性のために`apiGet`を使用することを推奨します。

3. **認証エンドポイント**（`/api/auth/*`）はCSRF保護の対象外です。NextAuthが管理します。

4. **エラーハンドリング**を適切に実装してください。特に認証エラー（401）の場合はログインページにリダイレクトすることを推奨します。

## トラブルシューティング

### CSRFトークンエラーが発生する

1. `/api/csrf-token`エンドポイントが正常に動作しているか確認
2. クッキーが正しく設定されているか確認（ブラウザの開発者ツールで確認）
3. リクエストヘッダーに`x-csrf-token`が含まれているか確認

### ネットワークエラーが発生する

1. サーバーが起動しているか確認
2. CORS設定を確認
3. ネットワーク接続を確認

### 認証エラーが発生する

1. セッションが有効か確認
2. ログインページにリダイレクトする処理を実装

