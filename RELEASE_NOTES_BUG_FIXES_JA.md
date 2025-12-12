IT環境リリースノート（12/10 - バグ修正版）

## 🐛 バグ修正

### 💬 チャット・メッセージ関連

**ステータスウィンドウ表示の修正**
- **問題**: ステータス設定がない場合でもコードブロックが状態窓として表示されていた
- **対応**: 
  - `ChatMessageParser`コンポーネントで`hasStatusWindow=false`時にコードブロックを完全に非表示化
  - AIプロンプトから空のステータス指示を除去し、不要な生成を抑止
  - マークダウン変換は維持したまま、コードブロックのみ選択的に非表示
- **影響範囲**: `src/components/ChatMessageParser.tsx`, `src/app/api/chat/messages/route.ts`, `src/app/api/chat/[chatId]/route.ts`

**チャットリスト - 未ログイン時エラーの改善**
- **問題**: 未ログイン状態でチャットリストにアクセスするとエラーメッセージのみ表示され、ログインページへ誘導されない
- **対応**: 
  - 未認証で401エラーの場合、自動的に`/login?redirect=/chatlist`へリダイレクト
  - エラーモーダル通知を追加し、適切なログイン導線を確保
- **影響範囲**: チャットリスト関連API

---

### 🔐 認証・セキュリティ関連

**リフレッシュトークン無効化の強化**
- **問題**: JWT戦略でNextAuthの`signOut`イベントが発火しないケースで、データベース上のrefresh tokenが残存する可能性
- **対応**: 
  - `src/lib/nextauth.ts`に`events.signOut`コールバックを追加し、`refresh_token`/`access_token`/`expires_at`を明示的にnull更新
  - 新規API`/api/auth/logout`を実装し、全ログアウト経路から呼び出し
  - セッションタイムアウト、手動ログアウト、退会、停止時のすべてで確実にDB側トークンを無効化
- **影響範囲**: 
  - `src/lib/nextauth.ts`
  - `src/app/api/auth/logout/route.ts`（新規）
  - `src/hooks/useSessionTimeout.ts`
  - `src/app/MyPage/page.tsx`
  - `src/app/suspended/page.tsx`
  - `src/app/profile/[userId]/page.tsx`

**CSRF トークン不一致エラー**
- **問題**: 古いセッションやタブを長時間開いた状態で操作するとCSRFトークン不一致でAPI呼び出しが403エラー
- **対応**: クッキーとヘッダーのトークン同期を改善（ユーザー側で新規タブまたは再ログインで解決）
- **備考**: ミドルウェアログで詳細な検証情報を記録し、問題発生時の原因特定を容易化

---

### 🎨 UI/UX関連

**ユーザーノートのXボタン重複**
- **問題**: 設定パネルとノートモーダルのXボタンが同時に表示され、UIが重複
- **対応**: サブモーダル（ノート/会話保存/表示設定）表示中はメインパネルのXボタンを非表示化
- **影響範囲**: チャット設定パネルコンポーネント

**ユーザー管理テーブルのレイアウト崩れ**
- **問題**: 画面解像度や長文セルによってテーブルが折り返し、レイアウトが崩れる
- **対応**: 
  - `table-auto` + `min-w` + `whitespace-nowrap` + `truncate`を設定
  - 操作ボタンを`flex-nowrap` + `flex-shrink-0`で固定しパディング調整
  - セル最小幅を`min-w-[200px]`に設定
- **影響範囲**: `src/app/admin/users/page.tsx`

**マイページ等のボタン位置ずれ**
- **問題**: モバイルや小画面でヘッダー・ボタンが折り返し、配置が崩れる
- **対応**: 
  - レスポンシブクラスを適用（`p-2 sm:p-3`, `w-full sm:w-auto`, `flex-col sm:flex-row`, `truncate`）
  - アイコンサイズを縮小版に調整
  - ボタンに`flex-shrink-0`を追加して固定配置
- **影響範囲**: 
  - `src/app/MyPage/page.tsx`
  - `src/app/profile/[userId]/page.tsx`
  - `src/app/MyPage/inquiries/page.tsx`
  - `src/app/notice/page.tsx`

---

### 🤖 AI生成・キャラクター関連

**リンクキャラクター自動生成の失敗**
- **問題**: Netlify環境でAI生成リクエストがタイムアウトや一時的なネットワーク不良時に即失敗
- **対応**: 
  - 生成系API（プロフィール/詳細/開始状況/日付・場所）に25秒タイムアウトを追加
  - エラーレスポンスをタイムアウト・クォータ・ネットワーク別に分岐
  - 全生成APIで`ensureGcpCreds()`を実行し、GCP認証を保証
  - クライアント側で最大2回リトライ（計3回試行、1秒間隔）を実装
  - ユーザー向けエラーメッセージを明確化
- **影響範囲**: 
  - `src/app/api/characters/generate-profile/route.ts`
  - `src/app/api/characters/generate-detail/route.ts`
  - `src/app/api/characters/generate-situation/route.ts`
  - `src/app/api/characters/generate-date-place/route.ts`
  - `src/components/CharacterForm.tsx`

---

## 🔧 技術的改善

### ビルド・デプロイ関連

**ビルドエラーの解消**
- **問題**: 
  - `node:fs` / `node:path`の動的importでWebpackの`UnhandledSchemeError`が発生
  - `/api/auth/logout`の未使用パラメータでESLintエラー
- **対応**: 
  - `src/lib/load-env-vars.ts`の動的importを`node:fs`から標準`fs`に変更
  - 未使用の`request`パラメータを削除
- **影響範囲**: 
  - `src/lib/load-env-vars.ts`
  - `src/app/api/auth/logout/route.ts`

---

## 📊 変更されたファイル

### 新規追加
- `src/app/api/auth/logout/route.ts` - リフレッシュトークン無効化API
- `BUG_FIXES_SUMMARY_JA.md` - バグ修正内容の詳細ドキュメント

### 主要変更
- `src/lib/nextauth.ts` - `events.signOut`コールバック追加
- `src/hooks/useSessionTimeout.ts` - ログアウト時のトークン無効化API呼び出し
- `src/components/ChatMessageParser.tsx` - ステータスウィンドウ表示ロジック修正
- `src/app/api/chat/messages/route.ts` - AIプロンプトからの空ステータス指示削除
- `src/app/api/chat/[chatId]/route.ts` - AIプロンプトからの空ステータス指示削除
- `src/app/admin/users/page.tsx` - テーブルレイアウト修正
- `src/app/MyPage/page.tsx` - レスポンシブデザイン改善、ログアウトAPI統合
- `src/app/profile/[userId]/page.tsx` - レスポンシブデザイン改善、ログアウトAPI統合
- `src/app/MyPage/inquiries/page.tsx` - レスポンシブデザイン改善
- `src/app/notice/page.tsx` - レスポンシブデザイン改善
- `src/app/suspended/page.tsx` - ログアウトAPI統合
- `src/app/api/characters/generate-profile/route.ts` - タイムアウト・リトライ機能追加
- `src/app/api/characters/generate-detail/route.ts` - タイムアウト・リトライ機能追加
- `src/app/api/characters/generate-situation/route.ts` - タイムアウト・リトライ機能追加
- `src/app/api/characters/generate-date-place/route.ts` - タイムアウト・リトライ機能追加
- `src/components/CharacterForm.tsx` - クライアント側リトライロジック実装
- `src/lib/load-env-vars.ts` - `node:fs`/`node:path` import修正

---

## ⚠️ 重要な注意事項

### セキュリティ改善
- ログアウト時のリフレッシュトークン無効化が確実に実行されるようになりました
- セッションタイムアウト時も自動的にトークンが無効化されます
- 複数デバイスでのログイン状態管理が改善されました

### UI/UX改善
- モバイル・タブレット環境でのレイアウトが大幅に改善されました
- 画面サイズに関わらず、一貫したUI表示を維持します
- ステータスウィンドウの表示/非表示が設定に応じて正しく動作します

### AI生成機能の安定性
- ネットワーク不良やタイムアウト時の自動リトライにより成功率が向上しました
- エラーメッセージがより具体的になり、問題の特定が容易になりました

---

## 🚀 デプロイ手順

1. 最新のコードをプル
   ```bash
   git pull origin main
   ```

2. 依存関係のインストール
   ```bash
   npm ci
   ```

3. ビルド確認
   ```bash
   npm run build
   ```

4. デプロイ
   - AWS Amplifyが自動的にビルドとデプロイを実行します

---

## 📝 既知の問題

### CSRFトークン不一致
- 長時間タブを開いたままの状態で操作すると、まれにCSRFトークン不一致エラーが発生する場合があります
- **回避方法**: ページを新規タブで開くか、再ログインすることで解決します
- 根本的な解決策として、トークン同期メカニズムの強化を検討中です

---

## 🔄 次回リリース予定

- 年齢確認システムの実装（生年月日入力、年齢検証API、Age Gateページ）
- CSRFトークン同期の根本的な改善
- さらなるモバイルUI/UX改善

---

**リリース日**: 2025年12月10日  
**対応者**: Development Team  
**バージョン**: v1.2.0-bugfix






