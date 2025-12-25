# 通報・お問い合わせフォームのCSRFトークン修正

## 問題の概要

通報機能（キャラクター通報）とお問い合わせ機能で、フォーム送信時にCSRFトークンが含まれていなかったため、403エラーが発生していました。

## 発生したエラー

- **エラーメッセージ**: `Failed to load resource: the server responded with a status of 403`
- **エンドポイント**: `/api/reports` (POST)
- **影響範囲**:
  - キャラクター詳細ページからの通報機能
  - マイページのお問い合わせ機能

## 原因

### 1. CSRFトークンの未実装

両機能とも、APIリクエスト時に標準の`fetch`を使用しており、CSRFトークンをリクエストヘッダーに含めていませんでした。

```typescript
// 修正前（src/app/characters/[characterId]/page.tsx）
const res = await fetch('/api/reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});

// 修正前（src/app/MyPage/inquiries/page.tsx）
const res = await fetch('/api/reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});
```

### 2. ミドルウェアによるCSRF検証

`src/middleware.ts`では、POST/PUT/DELETE/PATCHリクエストに対してCSRFトークンの検証を実施しています。トークンが存在しない、または無効な場合、403エラーを返します。

```typescript
// src/middleware.ts のCSRF検証ロジック
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
  if (!cookieToken || !headerToken || cookieToken.split(':')[0] !== headerToken) {
    return NextResponse.json(
      { error: 'CSRFトークンが無効です。' },
      { status: 403 }
    );
  }
}
```

## 対応内容

### 1. fetchWithCsrfの実装

既存の`src/lib/csrf-client.ts`の`fetchWithCsrf`関数を使用して、CSRFトークンを自動的にリクエストヘッダーに追加するように修正しました。

```typescript
// src/lib/csrf-client.ts
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCsrfToken();
  
  const headers = new Headers(options.headers);
  headers.set('x-csrf-token', token);
  
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  });
}
```

### 2. キャラクター通報機能の修正

**ファイル**: `src/app/characters/[characterId]/page.tsx`

- `fetchWithCsrf`のimportを確認（既に存在）
- `handleReportConfirm`関数内の`fetch`を`fetchWithCsrf`に変更

```typescript
// 修正後
import { fetchWithCsrf } from "@/lib/csrf-client";

const handleReportConfirm = async () => {
  // ...
  try {
    const res = await fetchWithCsrf('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CHARACTER_REPORT',
        characterId: parseInt(characterId, 10),
        reason: reportReason,
        content: reportContent,
      }),
    });
    // ...
  }
};
```

### 3. お問い合わせ機能の修正

**ファイル**: `src/app/MyPage/inquiries/page.tsx`

- `fetchWithCsrf`のimportを追加
- `handleSubmitInquiry`関数内の`fetch`を`fetchWithCsrf`に変更

```typescript
// 修正後
import { fetchWithCsrf } from '@/lib/csrf-client';

const handleSubmitInquiry = async () => {
  // ...
  try {
    setSubmitting(true);
    const res = await fetchWithCsrf('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'INQUIRY',
        reason: INQUIRY_TYPES.find(t => t.value === inquiryType)?.label || inquiryType,
        title: inquiryTitle,
        content: inquiryContent,
      }),
    });
    // ...
  }
};
```

## 検証方法

### 1. キャラクター通報のテスト

1. キャラクター詳細ページにアクセス
2. 「通報」ボタンをクリック
3. 通報理由と内容を入力
4. 「送信」ボタンをクリック
5. 正常に通報が送信されることを確認（403エラーが発生しない）

### 2. お問い合わせのテスト

1. マイページの「お問い合わせ」にアクセス
2. 「新規お問い合わせ」ボタンをクリック
3. 種類、タイトル、内容を入力
4. 「送信」ボタンをクリック
5. 正常にお問い合わせが送信されることを確認（403エラーが発生しない）

## 影響範囲

### 修正されたファイル

- `src/app/characters/[characterId]/page.tsx`
- `src/app/MyPage/inquiries/page.tsx`

### 影響を受けない機能

- 既に`fetchWithCsrf`を使用している他の機能（パスワード変更、キャラクター作成・編集など）は影響を受けません

## 今後の対策

### 1. 統一的なCSRF保護の徹底

すべてのPOST/PUT/DELETE/PATCHリクエストで`fetchWithCsrf`を使用することを徹底します。

### 2. コードレビュー時のチェックポイント

- APIリクエストを行う際は、必ず`fetchWithCsrf`を使用しているか確認
- 新しいフォーム追加時は、CSRFトークンが含まれているか確認

### 3. テストの追加

E2Eテストで、通報・お問い合わせ機能のCSRF保護が正しく機能していることを確認するテストケースを追加することを推奨します。

## まとめ

通報・お問い合わせフォームのCSRFトークン未実装の問題を修正し、両機能が正常に動作するようになりました。今後は、すべてのフォーム送信で`fetchWithCsrf`を使用することで、同様の問題を防ぐことができます。

