# E2E テスト実行ガイド

このディレクトリには、NAMOAIChat の E2E（End-to-End）テストが含まれています。

> 📖 **簡易版ガイド**: より簡単な実行方法は [docs/E2E_TEST_EXECUTION_GUIDE.md](../docs/E2E_TEST_EXECUTION_GUIDE.md) を参照してください。

## 📋 目次

- [前提条件](#前提条件)
- [ローカル実行](#ローカル実行)
- [CI/CD実行](#cicd実行)
- [テスト構成](#テスト構成)
- [トラブルシューティング](#トラブルシューティング)

## 前提条件

### 必要な環境

- Node.js 20.19.4 以上
- npm 10.8.2 以上
- Playwright がインストールされていること

### 環境変数

テスト実行前に以下の環境変数を設定してください：

```bash
# テスト対象のベースURL（デフォルト: http://localhost:3000）
export PLAYWRIGHT_BASE_URL=http://localhost:3000

# テスト用ユーザーの認証情報（オプション）
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword123

# データベース接続情報（ポイント確認用、オプション）
export DATABASE_URL=postgresql://...
```

### Playwright のインストール

```bash
# ブラウザをインストール
npx playwright install
```

## ローカル実行

### 1. 開発サーバーの起動

```bash
# 開発サーバーを起動（別ターミナル）
npm run dev
```

### 2. テスト実行

```bash
# すべてのテストを実行
npm run test:e2e

# 特定のテストファイルを実行
npm run test:e2e -- e2e/points-critical.spec.ts

# UIモードで実行（デバッグに便利）
npm run test:e2e:ui

# ヘッドモードで実行（ブラウザを表示）
npm run test:e2e:headed

# デバッグモードで実行
npm run test:e2e:debug
```

### 3. テストレポートの確認

```bash
# HTMLレポートを表示
npm run test:e2e:report
```

## CI/CD実行

### GitHub Actions

`.github/workflows/e2e-tests.yml` を参照してください。

### 実行コマンド

```bash
# CI環境での実行
CI=true npm run test:e2e
```

## テスト構成

### P0: クリティカルテスト

**ファイル**: `e2e/points-critical.spec.ts`

最重要なポイント関連のテストシナリオ：

1. **P0-1**: 新規登録 → 初期ポイント確認 → チャット1往復 → ポイント減少
2. **P0-2**: 画像作成 → 生成成功 → ポイント減少（失敗時は減らない）
3. **P0-3**: ポイント0でチャット不可 → 「ポイント購入が必要です」表示 + 購入導線
4. **P0-4**: ポイント0で画像作成不可 → 同上
5. **P0-5**: 通信断/LLM失敗時 → エラー表示 + ポイント減らない + 再試行できる
6. **P0-6**: ログアウト→再ログインでキャラ/履歴/ポイント保持

### その他のテスト

- `e2e/auth.spec.ts`: 認証機能のテスト
- `e2e/chat.spec.ts`: チャット機能のテスト
- `e2e/character-search.spec.ts`: キャラクター検索のテスト
- `e2e/admin-*.spec.ts`: 管理者機能のテスト

### ヘルパー関数

`e2e/helpers/` ディレクトリに共通のヘルパー関数があります：

- `auth.ts`: 認証関連（ログイン、ログアウト、テストユーザー作成）
- `points.ts`: ポイント関連（UI/APIからポイント取得、更新待機）
- `chat.ts`: チャット関連（メッセージ送信、応答待機）
- `image.ts`: 画像生成関連（画像生成、完了待機）

## トラブルシューティング

### テストが失敗する場合

1. **開発サーバーが起動しているか確認**
   ```bash
   curl http://localhost:3000
   ```

2. **ブラウザがインストールされているか確認**
   ```bash
   npx playwright install
   ```

3. **環境変数が正しく設定されているか確認**
   ```bash
   echo $PLAYWRIGHT_BASE_URL
   ```

4. **スクリーンショットとトレースを確認**
   - 失敗時は自動的に `test-results/` に保存されます
   - HTMLレポートで確認: `npm run test:e2e:report`

### よくある問題

#### タイムアウトエラー

- テストのタイムアウト時間を延長する
- ネットワーク速度を確認する
- サーバーの応答時間を確認する

#### 要素が見つからない

- セレクターを確認する（`data-testid` を優先）
- ページの読み込み完了を待つ（`waitForLoadState`）
- スクリーンショットで実際の状態を確認する

#### 認証エラー

- テスト用ユーザーが正しく作成されているか確認
- セッションクッキーが正しく設定されているか確認

## テストID（data-testid）の追加

テストの安定性を向上させるため、重要な要素に `data-testid` を追加することを推奨します：

```tsx
// 例
<button data-testid="send-message-button">送信</button>
<input data-testid="chat-input" type="text" />
<div data-testid="points-total">1000</div>
```

## 参考資料

- [Playwright 公式ドキュメント](https://playwright.dev/)
- [テストシナリオ一覧](../docs/E2E_TEST_CASES.md)
- [実行ガイド（簡易版）](../docs/E2E_TEST_EXECUTION_GUIDE.md)
- [**完全ガイド（韓国語版）**](../docs/E2E_TEST_GUIDE_KO.md) ⭐ **推奨**
- [実行ガイド（韓国語版・旧版）](../docs/E2E_TEST_EXECUTION_GUIDE_KO.md)
