# E2E テスト実行ガイド（簡易版）

**最終更新**: 2025年12月22日

> 🇰🇷 **韓国語版**: [E2E_TEST_EXECUTION_GUIDE_KO.md](./E2E_TEST_EXECUTION_GUIDE_KO.md) を参照してください。

---

## 🚀 クイックスタート

### 1. 前提条件の確認

```bash
# Node.js バージョン確認
node --version  # 20.19.4 以上が必要

# npm バージョン確認
npm --version   # 10.8.2 以上が必要
```

### 2. Playwright のインストール

```bash
# ブラウザをインストール（初回のみ）
npx playwright install chromium
```

### 3. 開発サーバーの起動

**別のターミナルで実行**:

```bash
# 開発サーバーを起動
npm run dev
```

サーバーが起動したら、`http://localhost:3000` にアクセスできることを確認してください。

---

## 📝 基本的な実行方法

### すべてのテストを実行

```bash
npm run test:e2e
```

### P0（クリティカル）テストのみ実行

```bash
npm run test:e2e -- e2e/points-critical.spec.ts
```

### 特定のテストファイルを実行

```bash
# 認証機能のみ
npm run test:e2e -- e2e/user-auth.spec.ts

# チャット機能のみ
npm run test:e2e -- e2e/chat.spec.ts

# 管理者機能のみ
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### 特定のテストケースのみ実行

```bash
# テスト名でフィルタリング
npm run test:e2e -- --grep "P0-1"

# または
npm run test:e2e -- -g "新規登録"
```

---

## 🎯 デバッグモード

### UIモード（推奨）

ブラウザでテストを視覚的に確認しながら実行できます：

```bash
npm run test:e2e:ui
```

**特徴**:
- テストをステップごとに実行可能
- ブラウザ操作をリアルタイムで確認
- デバッグに最適

### ヘッドモード（ブラウザを表示）

```bash
npm run test:e2e:headed
```

**特徴**:
- ブラウザウィンドウが表示される
- テストの動作を目視確認可能

### デバッグモード

```bash
npm run test:e2e:debug
```

**特徴**:
- Playwright Inspectorが起動
- ブレークポイントを設定可能
- ステップ実行が可能

---

## ⚙️ 環境変数の設定

### Windows (PowerShell)

```powershell
# テスト対象のベースURL
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"

# テスト用ユーザー（オプション）
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"

# 管理者アカウント（管理者テスト用）
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="adminpassword123"
```

### Windows (CMD)

```cmd
set PLAYWRIGHT_BASE_URL=http://localhost:3000
set TEST_EMAIL=test@example.com
set TEST_PASSWORD=testpassword123
```

### Linux/Mac

```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword123
```

### .env ファイルを使用（推奨）

プロジェクトルートに `.env.local` を作成：

```bash
# .env.local
PLAYWRIGHT_BASE_URL=http://localhost:3000
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=adminpassword123
```

**注意**: `.env.local` は `.gitignore` に含まれていることを確認してください。

---

## 📊 テスト結果の確認

### HTMLレポートを表示

```bash
npm run test:e2e:report
```

ブラウザでHTMLレポートが開き、以下を確認できます：
- テスト結果の一覧
- 失敗したテストの詳細
- スクリーンショット
- 動画（失敗時）
- トレース（失敗時）

### テスト結果の保存場所

- **HTMLレポート**: `playwright-report/`
- **スクリーンショット**: `test-results/`
- **動画**: `test-results/`（失敗時のみ）
- **トレース**: `test-results/`（失敗時のみ）

---

## 🔧 よく使うコマンド

### 並列実行を無効化（デバッグ時）

```bash
npm run test:e2e -- --workers=1
```

### タイムアウトを延長

```bash
npm run test:e2e -- --timeout=60000
```

### 特定のブラウザで実行

```bash
# Chromium のみ
npm run test:e2e -- --project=chromium

# Firefox のみ（設定が必要）
npm run test:e2e -- --project=firefox
```

### 失敗したテストのみ再実行

```bash
npm run test:e2e -- --last-failed
```

---

## 🐛 トラブルシューティング

### 問題1: 開発サーバーに接続できない

**症状**: `ECONNREFUSED` エラー

**解決方法**:
```bash
# 1. 開発サーバーが起動しているか確認
curl http://localhost:3000

# 2. 別のポートを使用している場合、環境変数を設定
$env:PLAYWRIGHT_BASE_URL="http://localhost:3001"
```

### 問題2: ブラウザが見つからない

**症状**: `Executable doesn't exist` エラー

**解決方法**:
```bash
# ブラウザを再インストール
npx playwright install chromium
```

### 問題3: 要素が見つからない

**症状**: `Locator not found` エラー

**解決方法**:
1. スクリーンショットを確認: `test-results/` フォルダ
2. タイムアウトを延長: `--timeout=60000`
3. `data-testid` が追加されているか確認

### 問題4: 認証エラー

**症状**: ログインに失敗する

**解決方法**:
1. テスト用ユーザーが存在するか確認
2. 環境変数 `TEST_EMAIL` と `TEST_PASSWORD` が正しく設定されているか確認
3. 開発サーバーでユーザーを作成済みか確認

### 問題5: タイムアウトエラー

**症状**: `Timeout exceeded` エラー

**解決方法**:
```bash
# タイムアウトを延長して実行
npm run test:e2e -- --timeout=120000
```

---

## 📋 実行例

### 例1: P0テストのみ実行（ローカル）

```bash
# 1. 開発サーバーを起動（別ターミナル）
npm run dev

# 2. P0テストを実行
npm run test:e2e -- e2e/points-critical.spec.ts
```

### 例2: UIモードでデバッグ

```bash
# 1. 開発サーバーを起動（別ターミナル）
npm run dev

# 2. UIモードで実行
npm run test:e2e:ui

# 3. ブラウザでテストを選択して実行
```

### 例3: 特定のテストケースのみ実行

```bash
# "新規登録" を含むテストのみ実行
npm run test:e2e -- --grep "新規登録"
```

### 例4: 環境変数を設定して実行（Windows PowerShell）

```powershell
# 環境変数を設定
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"

# テストを実行
npm run test:e2e
```

---

## 🎯 CI/CDでの実行

### GitHub Actions

`.github/workflows/e2e-tests.yml` が自動的に実行されます。

**手動実行**:
1. GitHubリポジトリの「Actions」タブに移動
2. 「E2E Tests」ワークフローを選択
3. 「Run workflow」をクリック

### ローカルでCIモードをシミュレート

```bash
# CI環境変数を設定
$env:CI="true"
npm run test:e2e
```

---

## 📚 参考資料

- [E2Eテスト実行ガイド（詳細）](../e2e/README.md)
- [テストケース一覧](./E2E_TEST_CASES_TABLE.md)
- [P0テストシナリオ](./E2E_TEST_SCENARIOS_P0.md)
- [Playwright公式ドキュメント](https://playwright.dev/)

---

## 💡 ヒント

1. **初回実行時**: UIモード（`npm run test:e2e:ui`）を使用して、テストの動作を確認することを推奨
2. **デバッグ時**: ヘッドモード（`npm run test:e2e:headed`）でブラウザを表示しながら実行
3. **CI/CD**: 通常モード（`npm run test:e2e`）で自動実行
4. **特定のテスト**: `--grep` オプションでフィルタリング

---

## ❓ よくある質問

### Q: テストが遅いです

**A**: 並列実行を無効化してみてください：
```bash
npm run test:e2e -- --workers=1
```

### Q: テストが不安定です

**A**: 
1. タイムアウトを延長
2. `data-testid` を追加
3. `waitForLoadState('networkidle')` を追加

### Q: スクリーンショットが見たい

**A**: 
```bash
# 失敗時のみ自動保存されます
# HTMLレポートで確認
npm run test:e2e:report
```

### Q: テスト用ユーザーを作成するには？

**A**: 
1. 開発サーバーで手動でユーザーを作成
2. または、`createTestUser()` 関数を実装（現在はモック）

---

**問題が解決しない場合**: `test-results/` フォルダのスクリーンショットとログを確認してください。

