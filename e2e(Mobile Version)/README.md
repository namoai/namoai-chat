# モバイル版E2Eテスト

このディレクトリには、モバイルデバイス（Android、iOS）向けのE2Eテストが含まれています。

## 概要

PC版と機能は同じですが、レイアウトやUI要素の配置が異なる可能性があります。
このテストは以下のデバイスで実行されます：

- **Android**: Pixel 5 (393x851)
- **iOS**: iPhone 12 (390x844)

## テスト実行方法

### すべてのモバイルテストを実行（Android + iOS）

```bash
npm run test:e2e:mobile
```

### UIモードで実行

```bash
npm run test:e2e:mobile:ui
```

### Androidのみ実行

```bash
npm run test:e2e:mobile:android
```

### iOSのみ実行

```bash
npm run test:e2e:mobile:ios
```

### 特定のテストファイルを実行

```bash
npx playwright test --config=playwright.mobile.config.ts e2e(Mobile Version)/auth.spec.ts
```

### 特定のプロジェクト（AndroidまたはiOS）で特定のテストを実行

```bash
npx playwright test --config=playwright.mobile.config.ts --project=android e2e(Mobile Version)/auth.spec.ts
npx playwright test --config=playwright.mobile.config.ts --project=ios e2e(Mobile Version)/auth.spec.ts
```

## テストファイル構成

PC版と同じテストファイルが含まれています：

- `auth.spec.ts` - 認証機能
- `chat.spec.ts` - チャット機能
- `character-search.spec.ts` - キャラクター検索
- `user-*.spec.ts` - ユーザー機能関連
- `admin-*.spec.ts` - 管理者機能関連
- `misc-features.spec.ts` - その他の機能
- `points-critical.spec.ts` - ポイント機能

## ヘルパー関数

`helpers/` ディレクトリには、PC版と同じヘルパー関数と、モバイル専用のヘルパー関数が含まれています：

### PC版と共通
- `auth.ts` - 認証関連
- `chat.ts` - チャット関連
- `characters.ts` - キャラクター関連
- `admin.ts` - 管理者関連
- その他

### モバイル専用 (`mobile.ts`)
- `clickBottomNavLink()` - ハイトナビゲーションからリンクをクリック
- `navigateFromBottomNav()` - ハイトナビゲーションからURLに移動
- `isBottomNavVisible()` - ハイトナビゲーションの表示確認
- `scrollToElementMobile()` - 要素が見えるまでスクロール
- `tapElementMobile()` - タッチイベント処理
- `openMobileMenu()`, `closeMobileMenu()` - ハンバーガーメニュー（補助的）の開閉

## モバイル環境での注意事項

1. **画面サイズ**: モバイルデバイスは画面が小さいため、スクロールが必要な場合があります
2. **タッチイベント**: Playwrightは自動的にタッチイベントをシミュレートします
3. **レイアウト**: PC版と異なるレイアウトになる可能性がありますが、機能は同じです
4. **ナビゲーション**: モバイル版では**ハイトナビゲーション（BottomNav）**を使用します
   - 画面下部に固定されたナビゲーションバー
   - ホーム、チャット、キャラ一覧、ランキング、マイページの5つのタブ
   - ハンバーガーメニューは補助的な機能（MobileHeader内）として存在しますが、メインのナビゲーションはハイトナビゲーションです

## 環境変数

PC版と同じ環境変数が必要です：

- `TEST_EMAIL` - テスト用メールアドレス
- `TEST_PASSWORD` - テスト用パスワード
- `ADMIN_EMAIL` - 管理者メールアドレス
- `ADMIN_PASSWORD` - 管理者パスワード
- `PLAYWRIGHT_BASE_URL` - テスト対象のベースURL（デフォルト: http://localhost:3000）

## トラブルシューティング

### テストが失敗する場合

1. サーバーが起動していることを確認
2. 環境変数が正しく設定されていることを確認
3. モバイルブラウザがインストールされていることを確認: `npx playwright install`
4. スクリーンショットとビデオを確認（`playwright-report/` ディレクトリ）

### 特定のデバイスでテストを実行したい場合

`playwright.mobile.config.ts` の `projects` セクションでデバイスを変更できます。

利用可能なデバイス:
- `Pixel 5` (Android)
- `Pixel 7` (Android)
- `iPhone 12` (iOS)
- `iPhone 13` (iOS)
- `iPhone 14` (iOS)
- その他（Playwrightの `devices` を参照）

## PC版との違い

- テストディレクトリ: `e2e(PC Version)` → `e2e(Mobile Version)`
- 設定ファイル: `playwright.config.ts` → `playwright.mobile.config.ts`
- デバイス: Desktop Chrome → Pixel 5 / iPhone 12

機能は同じですが、レイアウトやUI要素の配置が異なる可能性があります。

