# E2Eテスト自動化 現状分析レポート

**作成日**: 2025年12月22日

---

## 📋 実行サマリー

現在のプロジェクトには**E2Eテスト自動化は実装されていません**。代わりに、**API統合テスト**が実装されています。

---

## ✅ 現在実装されているもの

### 1. API統合テスト（Web UI版）

**場所**: `/admin/test`

**実装方式**:
- Next.jsのサーバーコンポーネント/クライアントコンポーネント
- `fetch` APIを使用したHTTPリクエスト
- ブラウザで実行されるが、**ブラウザの操作は自動化されていない**

**テストカテゴリー**:
1. **認証・セッション** (2テスト)
   - セッション確認
   - ユーザー情報取得

2. **ポイント機能** (4テスト)
   - ポイント情報取得
   - ポイントチャージ
   - 出席チェック
   - ポイント最終確認

3. **キャラクター機能** (4テスト)
   - キャラクター一覧取得
   - キャラクター詳細取得
   - キャラクター作成
   - キャラクター検索

4. **チャット機能** (3テスト)
   - チャットリスト取得
   - 新規チャット作成
   - メッセージ送信

5. **ソーシャル機能** (4テスト)
   - プロフィール取得
   - フォロー/アンフォロー
   - いいね機能
   - コメント機能

6. **通知機能** (3テスト)
   - 通知一覧取得
   - 未読通知数取得
   - 通知既読処理

7. **その他機能** (5テスト)
   - ランキング取得
   - 検索機能
   - ペルソナ一覧取得
   - ペルソナ作成
   - ペルソナ削除

**合計**: **25テストケース**

**動作の仕方**:
```typescript
// 実際のコード例（キャラクター一覧取得）
const charsRes = await fetch('/api/charlist');
const charsResult = await charsRes.json();
if (charsRes.ok) {
  const characters = Array.isArray(charsResult) ? charsResult : (charsResult.characters || []);
  updateTestResult(categoryIndex, testIndex, 'success', `${characters.length}件のキャラクター`, duration);
}
```

**特徴**:
- ✅ テスト結果をリアルタイムで表示
- ✅ AI分析機能（Gemini APIを使用）
- ✅ テスト環境の自動セットアップ（テスト用ユーザー・キャラクター作成）
- ✅ テストデータのクリーンアップ機能
- ❌ **ブラウザの操作は自動化されていない**
- ❌ **UI要素のクリック、入力などは手動**

---

### 2. API統合テスト（CLI版）

**場所**: `scripts/test-runner.mjs`

**実装方式**:
- Node.jsスクリプト
- `fetch` APIを使用したHTTPリクエスト
- コマンドラインから実行可能

**実行方法**:
```bash
npm run test -- --email admin@example.com --password pass123
```

**オプション**:
- `--url`: APIサーバーURL
- `--email`: ログイン用メールアドレス
- `--password`: ログイン用パスワード
- `--category`: 特定カテゴリーのみテスト
- `--test`: 特定テストのみ実行
- `--json`: JSON形式で出力
- `--output`: 結果をファイルに保存
- `--ai-analysis`: AI分析を含める
- `--auto-create`: テスト用キャラクター自動生成

**動作の仕方**:
```javascript
// 実際のコード例（ログイン処理）
async function login(email, password) {
  const formData = new URLSearchParams();
  formData.append('email', email);
  formData.append('password', password);
  
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    credentials: 'include',
  });
  
  setCookies(response.headers); // クッキーを保存して以降のリクエストで使用
  // ...
}
```

**特徴**:
- ✅ CI/CDパイプラインに統合可能
- ✅ 結果をJSON形式で出力可能
- ✅ テスト間の依存関係を管理（クッキーベースのセッション管理）
- ❌ **ブラウザの操作は自動化されていない**
- ❌ **UIテストは不可**

---

### 3. セキュリティテスト

**場所**: `/admin/security-test`

**実装方式**:
- Web UI（React + TypeScript）
- APIエンドポイントに対してリクエストを送信

**テスト内容**:
- CSRFトークン検証
- セッションセキュリティ
- 環境変数セキュリティ
- パスワードポリシー
- API認証
- 2要素認証（2FA）

**動作の仕方**:
```typescript
// 実際のコード例（CSRFテスト）
const result = await apiPost<{ message?: string }>('/api/admin/security-test', { 
  testType: 'csrf-valid' 
});
```

**特徴**:
- ✅ セキュリティ機能に特化
- ✅ 管理者権限が必要
- ❌ **ブラウザの操作は自動化されていない**

---

## ❌ 実装されていないもの

### 1. 真のE2Eテスト（ブラウザ自動化）

**必要なもの**:
- Playwright、Cypress、Seleniumなどのブラウザ自動化ツール
- ブラウザでの操作シナリオ（クリック、入力、ナビゲーションなど）
- 視覚的な検証（スクリーンショット比較など）

**現状**:
- ❌ Playwright/Cypressの設定ファイルなし
- ❌ E2Eテストスクリプトなし
- ❌ ブラウザ操作の自動化なし

---

### 2. ユーザー観点でのシナリオテスト

**必要なもの**:
- ユーザージャーニーの自動化
  - 例: 「ユーザーがログイン → キャラクターを検索 → チャットを開始 → メッセージを送信」

**現状**:
- ❌ ユーザージャーニーを自動化するテストなし
- ❌ UI操作を伴うシナリオテストなし

---

### 3. 管理者観点でのシナリオテスト

**必要なもの**:
- 管理者機能の自動化
  - 例: 「管理者がログイン → キャラクター管理画面にアクセス → キャラクターを編集 → 保存」

**現状**:
- ❌ 管理者UI操作を自動化するテストなし
- ❌ 管理画面の操作シナリオテストなし

---

## 🔍 現在のテストの動作詳細

### Web UIテストツールの実際の動作フロー

1. **ログイン**
   ```typescript
   // NextAuthを使用したログイン（手動）
   const result = await signIn('credentials', {
     email, password, redirect: false,
   });
   ```

2. **テスト実行**
   ```typescript
   // 各テストは fetch API でHTTPリクエストを送信
   const res = await fetch('/api/characters/${charId}');
   const result = await res.json();
   ```

3. **結果表示**
   ```typescript
   // 状態を更新してUIに反映
   updateTestResult(categoryIndex, testIndex, 'success', message, duration);
   ```

**重要なポイント**:
- ブラウザは単なる**HTTPクライアント**として機能
- ボタンクリック、フォーム入力などのUI操作は**手動**
- テストはAPIエンドポイントの**統合テスト**として機能

---

### CLIテストランナーの実際の動作フロー

1. **ログイン**
   ```javascript
   // HTTPリクエストで認証
   const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
     method: 'POST',
     body: formData.toString(),
   });
   setCookies(response.headers); // クッキーを保存
   ```

2. **テスト実行**
   ```javascript
   // 保存したクッキーを使用してAPIリクエスト
   async function fetchWithAuth(url, options = {}) {
     const headers = { ...options.headers };
     if (cookies) {
       headers['Cookie'] = cookies; // セッション維持
     }
     return fetch(url, { ...options, headers });
   }
   ```

3. **結果出力**
   ```javascript
   // コンソールまたはJSONファイルに出力
   console.log(`${icon} [${categoryName}] ${testName} (${duration}ms)`);
   ```

**重要なポイント**:
- ブラウザなしで実行可能
- HTTPリクエストベースのAPIテスト
- セッション管理はクッキーで実現

---

## 📊 テストカバレッジの分析

### 現在カバーされているもの

| カテゴリー | テスト数 | 種類 | 備考 |
|----------|---------|------|------|
| 認証・セッション | 2 | API統合 | ✅ 実装済み |
| ポイント機能 | 4 | API統合 | ✅ 実装済み |
| キャラクター機能 | 4 | API統合 | ✅ 実装済み |
| チャット機能 | 3 | API統合 | ✅ 実装済み |
| ソーシャル機能 | 4 | API統合 | ✅ 実装済み |
| 通知機能 | 3 | API統合 | ✅ 実装済み |
| その他機能 | 5 | API統合 | ✅ 実装済み |
| **合計** | **25** | **API統合** | - |

### カバーされていないもの

| カテゴリー | 必要なテスト | 現状 |
|----------|------------|------|
| **UI操作** | ボタンクリック、フォーム入力 | ❌ なし |
| **ユーザージャーニー** | ログイン→検索→チャット→送信 | ❌ なし |
| **管理者操作** | 管理画面での操作シナリオ | ❌ なし |
| **視覚的検証** | スクリーンショット比較 | ❌ なし |
| **パフォーマンス** | ページ読み込み時間、レンダリング時間 | ❌ なし |
| **クロスブラウザ** | Chrome/Firefox/Safariでの動作確認 | ❌ なし |

---

## 🎯 E2Eテスト自動化の実装が必要な理由

### 現在のテストの限界

1. **UIの検証ができない**
   - ボタンが正しく表示されているか
   - フォームのバリデーションが動作するか
   - エラーメッセージが正しく表示されるか

2. **ユーザー体験の検証ができない**
   - 実際の操作フローがスムーズか
   - UIのレスポンスが適切か
   - ページ遷移が正しく動作するか

3. **フロントエンドとバックエンドの統合検証が不十分**
   - APIは動作するが、フロントエンドが正しく使用しているか
   - データの表示が正しいか
   - 状態管理が正しく動作しているか

---

## 💡 推奨されるE2Eテスト自動化の実装

### 1. ツールの選択

**推奨**: **Playwright**

**理由**:
- モダンで高速
- 複数ブラウザ（Chromium、Firefox、WebKit）をサポート
- TypeScriptの型サポートが充実
- スクリーンショット/動画の自動記録
- CI/CDへの統合が容易

**代替案**: Cypress（既存プロジェクトで使用している場合は検討）

---

### 2. 実装すべきテストシナリオ

#### ユーザー観点

1. **認証フロー**
   ```
   - ログインページにアクセス
   - メールアドレスとパスワードを入力
   - ログインボタンをクリック
   - ダッシュボードにリダイレクトされることを確認
   ```

2. **キャラクター検索・チャット開始**
   ```
   - ホームページにアクセス
   - 検索バーにキーワードを入力
   - 検索結果からキャラクターを選択
   - チャットを開始
   - 最初のメッセージが表示されることを確認
   ```

3. **メッセージ送信**
   ```
   - チャット画面でメッセージを入力
   - 送信ボタンをクリック
   - メッセージが表示されることを確認
   - AI応答が表示されることを確認（時間がかかる場合あり）
   ```

4. **ポイントチャージ**
   ```
   - ポイント画面にアクセス
   - チャージボタンをクリック
   - 金額を入力
   - チャージが成功することを確認
   - ポイント残高が更新されることを確認
   ```

#### 管理者観点

1. **キャラクター管理**
   ```
   - 管理画面にログイン
   - キャラクター管理ページにアクセス
   - キャラクター一覧が表示されることを確認
   - キャラクターを編集
   - 変更を保存
   - 変更が反映されることを確認
   ```

2. **お知らせ管理**
   ```
   - 管理画面にログイン
   - お知らせ管理ページにアクセス
   - お知らせを作成
   - タイトル、本文を入力
   - 公開設定を選択
   - 保存
   - お知らせ一覧に表示されることを確認
   ```

3. **ユーザー管理**
   ```
   - 管理画面にログイン
   - ユーザー管理ページにアクセス
   - ユーザー一覧が表示されることを確認
   - ユーザーを検索
   - ユーザー詳細を確認
   ```

---

### 3. 実装のステップ

#### ステップ1: Playwrightのセットアップ

```bash
npm install -D @playwright/test
npx playwright install
```

#### ステップ2: 設定ファイルの作成

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### ステップ3: テストファイルの作成例

```typescript
// e2e/user-login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ユーザーログイン', () => {
  test('メールアドレスでログインできる', async ({ page }) => {
    // ログインページにアクセス
    await page.goto('/login');
    
    // フォームに入力
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=ホーム')).toBeVisible();
  });
});
```

---

## 📝 まとめ

### 現在の状態

- ✅ **API統合テスト**: 実装済み（25テストケース）
  - Web UI版: `/admin/test`
  - CLI版: `scripts/test-runner.mjs`
- ❌ **E2Eテスト**: 未実装
- ❌ **ブラウザ自動化**: 未実装
- ❌ **ユーザー/管理者シナリオテスト**: 未実装

### 次のステップ

1. **短期的**: 現在のAPI統合テストを継続使用
2. **中期的**: Playwrightを導入してE2Eテストを実装
3. **長期的**: CI/CDパイプラインにE2Eテストを統合

### 優先度の高いテストシナリオ

1. **ユーザーログイン・認証フロー**（最優先）
2. **キャラクター検索・チャット開始**
3. **メッセージ送信**
4. **管理者：キャラクター管理**
5. **管理者：お知らせ管理**

---

**作成者**: 開発チーム  
**最終更新**: 2025年12月22日








