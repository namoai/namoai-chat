# 📋 NAMOAI Chat - 機能一覧表及びモジュール構成

> **プロジェクト**: Namos Chat v1  
> **技術スタック**: Next.js 15, TypeScript, Prisma, PostgreSQL, NextAuth, Google Gemini AI  
> **作成日**: 2025-10-27

---

## 📑 目次
1. [認証及びユーザー管理](#1-認証及びユーザー管理)
2. [キャラクター管理](#2-キャラクター管理)
3. [チャットシステム](#3-チャットシステム)
4. [ソーシャル機能](#4-ソーシャル機能)
5. [ペルソナシステム](#5-ペルソナシステム)
6. [ポイントシステム](#6-ポイントシステム)
7. [検索及びランキング](#7-検索及びランキング)
8. [管理者機能](#8-管理者機能)
9. [お知らせ及びガイド](#9-お知らせ及びガイド)
10. [共通モジュール](#10-共通モジュール)

---

## 1. 認証及びユーザー管理

### 📌 主要機能
- 会員登録/ログイン (メール、Google OAuth)
- プロフィール管理 (ニックネーム、画像、自己紹介)
- パスワード変更
- セーフティフィルター設定
- 会員退会 (2段階確認、キャラクター保持)

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/register/page.tsx` - 会員登録ページ
- `src/app/login/page.tsx` - ログインページ
- `src/app/MyPage/page.tsx` - マイページ
- `src/app/profile-edit/page.tsx` - プロフィール編集ページ
- `src/app/change-password/page.tsx` - パスワード変更ページ
- `src/app/profile/[userId]/page.tsx` - ユーザープロフィール閲覧

#### Backend (API Routes)
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth認証ハンドラー
- `src/app/api/register/route.ts` - 会員登録API
- `src/app/api/users/profile/route.ts` - プロフィール閲覧/編集API
- `src/app/api/users/change-password/route.ts` - パスワード変更API
- `src/app/api/users/safety-filter/route.ts` - セーフティフィルター設定API
- `src/app/api/users/account/route.ts` - アカウント削除API (会員退会)
- `src/app/api/profile/[userId]/route.ts` - 特定ユーザープロフィールAPI

#### ライブラリ
- `src/lib/nextauth.ts` - NextAuth設定
- `src/lib/prisma.ts` - Prismaクライアント

#### データベース
- `users` テーブル - ユーザー基本情報
- `Account` テーブル - OAuth アカウント連携
- `Session` テーブル - セッション管理
- `VerificationToken` テーブル - メール認証トークン

---

## 2. キャラクター管理

### 📌 主要機能
- AIキャラクター作成/編集/削除
- キャラクター画像アップロード (複数画像)
- キャラクター公開/非公開設定
- キャラクター詳細情報 (設定、システムテンプレート、最初の台詞など)
- キャラクターカテゴリー及びハッシュタグ
- ローブック (背景知識) 管理
- キャラクターお気に入り
- キャラクターコメント及び評価
- キャラクターインポート (Import)

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/charlist/page.tsx` - キャラクター一覧ページ
- `src/app/characters/create/page.tsx` - キャラクター作成ページ
- `src/app/characters/edit/[id]/page.tsx` - キャラクター編集ページ
- `src/app/characters/[characterId]/page.tsx` - キャラクター詳細ページ
- `src/app/character-management/page.tsx` - 自分のキャラクター管理ページ

#### Backend (API Routes)
- `src/app/api/characters/route.ts` - キャラクター作成/一覧取得API
- `src/app/api/characters/[id]/route.ts` - キャラクター詳細/編集/削除API
- `src/app/api/characters/[id]/favorite/route.ts` - お気に入り追加/削除API
- `src/app/api/characters/[id]/comments/route.ts` - コメント閲覧/作成API
- `src/app/api/characters/[id]/comments/[commentId]/route.ts` - コメント編集/削除API
- `src/app/api/characters/[id]/import/route.ts` - キャラクターインポートAPI
- `src/app/api/charlist/route.ts` - キャラクターリストAPI (フィルタリング)

#### Components
- `src/components/CharacterCard.tsx` - キャラクターカードコンポーネント
- `src/components/CharacterForm.tsx` - キャラクター作成/編集フォーム
- `src/components/CharacterRow.tsx` - キャラクター横並びリスト
- `src/components/SafeImage.tsx` - 画像安全表示コンポーネント

#### データベース
- `characters` テーブル - キャラクター基本情報
- `character_images` テーブル - キャラクター画像
- `lorebooks` テーブル - キャラクターローブック (ベクトル埋め込み)
- `favorites` テーブル - お気に入り
- `comments` テーブル - キャラクターコメント
- `embeddings` テーブル - キャラクター説明の埋め込み

---

## 3. チャットシステム

### 📌 主要機能
- AIキャラクターとのリアルタイムチャット
- チャット履歴管理
- メッセージ再生成 (ブランチ機能)
- 画像送信及び表示
- チャットノート (メモ) 機能
- チャット設定 (システムプロンプトのカスタマイズ)
- チャット削除

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/chat/[characterId]/page.tsx` - チャットメインページ
- `src/app/chatlist/page.tsx` - チャット一覧ページ
- `src/app/chatlist/ChatListPage.css` - チャット一覧スタイル

#### Backend (API Routes)
- `src/app/api/chat/new/route.ts` - 新規チャット作成API
- `src/app/api/chat/[chatId]/route.ts` - チャット閲覧/削除API
- `src/app/api/chat/[chatId]/note/route.ts` - チャットノート編集API
- `src/app/api/chat/messages/route.ts` - メッセージ閲覧API
- `src/app/api/chats/route.ts` - チャット一覧取得API
- `src/app/api/chats/find-or-create/route.ts` - チャット検索または作成API
- `src/app/api/chatlist/route.ts` - チャットリストAPI

#### Components
- `src/components/chat/ChatHeader.tsx` - チャットヘッダー
- `src/components/chat/ChatFooter.tsx` - チャット入力エリア
- `src/components/chat/ChatMessageList.tsx` - メッセージ一覧表示
- `src/components/chat/ConfirmationModal.tsx` - 確認モーダル
- `src/components/chat/ImageLightbox.tsx` - 画像拡大表示
- `src/components/ChatImageRenderer.tsx` - チャット画像レンダラー
- `src/components/ChatMessageParser.tsx` - メッセージパース (マークダウンなど)
- `src/components/ChatSettings.tsx` - チャット設定モーダル

#### Types
- `src/types/chat.ts` - チャット関連型定義

#### データベース
- `chat` テーブル - チャットルーム情報
- `chat_message` テーブル - チャットメッセージ (ブランチバージョン管理含む)
- `interactions` テーブル - ユーザー-キャラクター相互作用ログ

---

## 4. ソーシャル機能

### 📌 主要機能
- ユーザーフォロー/アンフォロー
- フォロワー/フォロイング一覧閲覧
- ユーザーブロック/ブロック解除
- ブロックリスト管理
- ユーザープロフィール閲覧

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/profile/[userId]/page.tsx` - ユーザープロフィールページ

#### Backend (API Routes)
- `src/app/api/profile/[userId]/follow/route.ts` - フォロー/アンフォローAPI
- `src/app/api/profile/[userId]/followers/route.ts` - フォロワー一覧API
- `src/app/api/profile/[userId]/following/route.ts` - フォロイング一覧API
- `src/app/api/profile/[userId]/block/route.ts` - ブロック/ブロック解除API
- `src/app/api/profile/[userId]/blocked-users/route.ts` - ブロックリストAPI

#### データベース
- `follows` テーブル - フォロー関係
- `Block` テーブル - ブロック関係

---

## 5. ペルソナシステム

### 📌 主要機能
- ペルソナ作成/編集/削除
- ペルソナ一覧閲覧
- デフォルトペルソナ設定
- チャット時のペルソナ適用

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/persona/form/[[...personaId]]/page.tsx` - ペルソナ作成/編集ページ
- `src/app/persona/list/page.tsx` - ペルソナ一覧ページ

#### Backend (API Routes)
- `src/app/api/persona/route.ts` - ペルソナ作成/一覧取得API
- `src/app/api/persona/[personaId]/route.ts` - ペルソナ閲覧/編集/削除API

#### データベース
- `personas` テーブル - ペルソナ情報
- `users.defaultPersonaId` - デフォルトペルソナ設定

---

## 6. ポイントシステム

### 📌 主要機能
- 無料ポイント/有料ポイント管理
- 出席チェック報酬
- ポイント履歴閲覧
- ポイント差し引き (チャット使用料)

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/points/page.tsx` - ポイント管理ページ

#### Backend (API Routes)
- `src/app/api/points/route.ts` - ポイント閲覧/更新API
- `src/app/api/users/points/route.ts` - ユーザーポイントAPI

#### データベース
- `points` テーブル - ポイント情報 (無料/有料分離)

---

## 7. 検索及びランキング

### 📌 主要機能
- キャラクター検索 (名前、説明、ハッシュタグ)
- 人気キャラクターランキング
- 新規キャラクターランキング
- カテゴリー別フィルタリング

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/search/page.tsx` - 検索ページ
- `src/app/ranking/page.tsx` - ランキングページ
- `src/app/page.tsx` - メインページ (トレンドキャラクター表示)

#### Backend (API Routes)
- `src/app/api/search/route.ts` - 検索API
- `src/app/api/ranking/route.ts` - ランキングAPI
- `src/app/api/main-page/route.ts` - メインページデータAPI

---

## 8. 管理者機能

### 📌 主要機能
- **ユーザー管理**
  - ユーザー一覧閲覧、検索
  - 権限編集 (USER, MODERATOR, CHAR_MANAGER, SUPER_ADMIN)
  - ユーザー停止 (1日, 3日, 7日, 1ヶ月, 3ヶ月, 100日, 1年, 永久停止)
  - 停止理由記録、停止期限管理
  - ユーザー情報編集 (名前、ニックネーム、メール、電話番号、自己紹介、権限)
  - ポイント手動管理 (無料ポイント、有料ポイント)
  - ユーザー削除 (キャラクターは匿名化して保持)
- **キャラクター管理** (承認、削除)
- **ガイド管理** (作成、編集、削除)
- **お知らせ管理**
- 管理者ダッシュボード

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/admin/page.tsx` - 管理者ダッシュボード
- `src/app/admin/users/page.tsx` - ユーザー管理ページ (停止、編集、削除機能含む)
- `src/app/admin/characters/page.tsx` - キャラクター管理ページ
- `src/app/admin/guides/page.tsx` - ガイド管理ページ

#### Backend (API Routes)
- `src/app/api/admin/users/route.ts` - ユーザー管理API (一覧、権限変更)
- `src/app/api/admin/users/suspend/route.ts` - ユーザー停止/解除API
- `src/app/api/admin/users/edit/route.ts` - ユーザー情報編集/ポイント管理API
- `src/app/api/admin/users/delete/route.ts` - ユーザー削除API
- `src/app/api/admin/characters/route.ts` - キャラクター管理API
- `src/app/api/admin/guides/route.ts` - ガイド管理API

#### データベース
- `users.role` - ユーザー権限 (USER, MODERATOR, CHAR_MANAGER, SUPER_ADMIN)
- `users.suspendedUntil` - ユーザー停止期限
- `users.suspensionReason` - 停止理由

---

## 9. お知らせ及びガイド

### 📌 主要機能
- お知らせ閲覧
- お知らせ作成/編集/削除 (管理者)
- ガイド閲覧 (カテゴリー別)
- ガイド作成/編集/削除 (管理者)

### 📂 関連モジュール

#### Frontend (Pages)
- `src/app/notice/page.tsx` - お知らせ一覧ページ
- `src/app/notice/[noticeId]/page.tsx` - お知らせ詳細ページ
- `src/app/notice/admin/page.tsx` - お知らせ管理ページ
- `src/app/notice/admin/[noticeId]/page.tsx` - お知らせ編集ページ
- `src/app/guide/page.tsx` - ガイドページ

#### Backend (API Routes)
- `src/app/api/notice/route.ts` - お知らせ一覧/作成API
- `src/app/api/notice/[noticeId]/route.ts` - お知らせ閲覧/編集/削除API
- `src/app/api/guides/route.ts` - ガイドAPI

#### Components
- `src/components/NoticeDetailClient.tsx` - お知らせ詳細クライアント
- `src/components/NoticeForm.tsx` - お知らせ作成フォーム

#### データベース
- `notices` テーブル - お知らせ
- `guides` テーブル - ガイド (メイン/サブカテゴリー)

---

## 10. 共通モジュール

### 📂 レイアウト及びナビゲーション
- `src/app/layout.tsx` - ルートレイアウト
- `src/app/globals.css` - グローバルスタイル
- `src/components/AppShell.tsx` - アプリシェル (ナビゲーション管理)
- `src/components/BottomNav.tsx` - 下部ナビゲーション
- `src/components/Providers.tsx` - Providerラッパー (NextAuthなど)

### 📂 UIコンポーネント
- `src/components/ui/button.tsx` - ボタンコンポーネント
- `src/components/ui/card.tsx` - カードコンポーネント
- `src/components/ui/checkbox.tsx` - チェックボックスコンポーネント
- `src/components/ui/dialog.tsx` - ダイアログコンポーネント
- `src/components/ui/input.tsx` - 入力コンポーネント
- `src/components/ui/textarea.tsx` - テキストエリアコンポーネント

### 📂 ユーティリティライブラリ
- `src/lib/db.ts` - データベース接続 (PostgreSQL)
- `src/lib/prisma.ts` - Prismaクライアント
- `src/lib/redis.ts` - Redisクライアント (Upstash)
- `src/lib/secrets.ts` - 秘密情報管理
- `src/lib/secrets-loader.ts` - GCP Secret Manager連携
- `src/lib/utils.ts` - 共通ユーティリティ関数

### 📂 セキュリティ及び認証
- `src/utils/ensureGcpCreds.ts` - GCP認証情報確認

### 📂 スクリプト
- `scripts/gsm-fetch.mjs` - GCP Secret Managerから秘密情報取得

### 📂 設定ファイル
- `next.config.ts` - Next.js設定
- `tailwind.config.js` - Tailwind CSS設定 (v4)
- `tsconfig.json` - TypeScript設定
- `prisma/schema.prisma` - データベーススキーマ
- `components.json` - shadcn/uiコンポーネント設定
- `netlify.toml` - Netlifyデプロイ設定

---

## 📊 データベーススキーマ要約

### コアテーブル
| テーブル名 | 用途 | 主要な関係 |
|---------|------|---------|
| `users` | ユーザー情報 | → characters, chat, personas, points |
| `characters` | AIキャラクター | → character_images, lorebooks, favorites |
| `chat` | チャットルーム | → chat_message, users, characters |
| `chat_message` | チャットメッセージ | → chat (ブランチバージョン管理) |
| `personas` | ユーザーペルソナ | → users |
| `points` | ポイントシステム | → users |
| `favorites` | お気に入り | users ↔ characters |
| `follows` | フォロー関係 | users ↔ users |
| `Block` | ブロック関係 | users ↔ users |
| `comments` | コメント | → characters, users |
| `lorebooks` | ローブック | → characters (ベクトル埋め込み) |
| `notices` | お知らせ | 独立テーブル |
| `guides` | ガイド | 独立テーブル |

---

## 🔧 主要技術スタック詳細

### Frontend
- **フレームワーク**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui
- **状態管理**: React Hooks
- **認証**: NextAuth v4

### Backend
- **ランタイム**: Node.js 20.19.4
- **API**: Next.js API Routes
- **ORM**: Prisma 6.11.1
- **データベース**: PostgreSQL (with pgvector)
- **キャッシュ**: Redis (Upstash)

### AI統合
- **AIモデル**: Google Gemini (Vertex AI)
- **ライブラリ**: `@google-cloud/vertexai`, `@google/generative-ai`
- **ベクトル検索**: pgvector (ローブック、埋め込み)

### インフラ
- **クラウド**: Google Cloud Platform
- **秘密管理**: GCP Secret Manager
- **デプロイ**: Netlify
- **ファイルストレージ**: AWS S3 または Supabase Storage

---

## 📈 開発ロードマップ (予想)

### ✅ 完了した機能
- ✅ ユーザー認証システム (メール + Google OAuth)
- ✅ 会員退会機能 (キャラクター保持、2段階確認)
- ✅ キャラクターCRUD
- ✅ AIチャット基本機能
- ✅ チャット画像送信/表示機能
- ✅ ポイントシステム
- ✅ ソーシャル機能 (フォロー/ブロック)
- ✅ 管理者ページ
- ✅ ペルソナシステム
- ✅ ローブック機能 (ベクトル検索)

### 🚧 改善可能な領域
- 🔄 リアルタイム通知システム
- 🔄 チャット画像生成 (AI)
- 🔄 音声チャット機能
- 🔄 決済システム (有料ポイント)
- 🔄 キャラクターマーケットプレイス
- 🔄 多言語サポート

---

## 📞 連絡先及びサポート

プロジェクト関連のお問い合わせは開発チームまでご連絡ください。

**作成日**: 2025-10-27  
**最終更新日**: 2025-10-28  
**ドキュメントバージョン**: 1.2

---

## 🆕 最新アップデート (v1.2 - 2025-10-28)

### 🛡️ 管理者機能の大幅強化
#### ユーザー停止機能
- **停止期間選択**: 1日、3日、7日、1ヶ月、3ヶ月、100日、1年、永久停止
- **停止理由記録**: 必須入力項目として管理
- **ログイン制限**: 停止中のユーザーがログインしようとすると、停止理由と期限を表示してブロック
- **停止状態表示**: ユーザー一覧で「正常」「停止中」バッジ表示
- **停止解除**: 確認ダイアログ付き停止解除機能

#### ユーザー情報編集機能
- **基本情報編集**: 名前、ニックネーム、メール、電話番号、自己紹介、権限
- **ポイント手動管理**: 無料ポイント、有料ポイントの設定
- **OAuth対応**: ソーシャルログインユーザーの識別と適切な情報表示

#### ユーザー削除機能
- **完全削除**: 全ての関連データを削除
- **キャラクター保持**: 作成したキャラクターは作成者を匿名化して残す
- **確認ダイアログ**: 誤操作防止のための確認メッセージ

### 💬 チャット機能の大幅改善
#### 再生成機能の完全リニューアル
- **全バージョン保持**: 再生成しても以前のバージョンを削除せず全て保存
- **バージョン表示**: `<1/4>`, `<2/4>` のような形式でバージョン番号表示
- **バージョン切り替え**: ◀ ▶ ボタンで過去のバージョンを閲覧可能
- **コンテキスト保持**: 閲覧中のバージョンを基に次の返答を生成
- **ローディング表示改善**: 
  - 小さい回転アイコン → メッセージバブル内に「再生成中...」と大きなアイコン表示
  - 再生成中はボタンを無効化
- **自動最新表示**: 再生成完了後、自動的に最新バージョン (`<4/4>`) を表示

#### メッセージ削除の改善
- **ユーザーメッセージ削除**: そのターンの全ての応答を削除
- **AIメッセージ削除**: 特定のバージョンのみ削除 (他のバージョンは保持)
- **確認ダイアログ**: 削除対象を明確に表示

#### 初期状況表示の改善
- **常時表示**: チャット入力後も初期状況メッセージが消えない
- **統一フォーマット**: 他のチャットメッセージと同じスタイルで表示
- **画像対応**: 初期メッセージにもキーワードベースの画像優先順位適用

### 🔍 チャットリスト機能強化
- **検索機能実装**: キャラクター名と最後のメッセージ内容で検索
- **チェックボックス修正**: 選択削除モードでのチェックボックスサイズ統一
- **リアルタイムフィルタリング**: 検索クエリに応じて即座に結果を表示

### 🎯 会員退会機能の実装
- **場所**: プロフィールページ (右上メニュー → ブロックリストの下)
- **特徴**:
  - 2段階確認プロセスで誤操作防止
  - キャラクターは削除せず作成者のみ匿名化
  - 個人データ (チャット、コメント、ポイントなど) は完全削除
  - 感謝メッセージ表示後に自動ログアウト

### 🔒 ログイン安定化
- Google OAuth認証の改善
- 存在しないユーザーのエラーハンドリング強化
- 削除済みアカウントのセッション無効化対応
- 停止中ユーザーのログインブロック (停止理由と期限表示)
- 認証失敗時の詳細なエラーメッセージ表示

### 🎨 UI/UX改善
- **全モーダルのテキスト色統一**: 15ファイルのモーダルを修正し、暗い背景でも読みやすい白色テキストに統一
- **プロフィール画像修正**: メイン画像がない場合でも最初の画像を表示するように優先順位ロジック改善

### 🔐 セキュリティ強化
- **キャラクター管理ページ**: 自分が作成したキャラクターのみ表示 (`/api/characters?mode=my`)
- **画像最適化**: `<img>` タグを `next/image` コンポーネントに変更

### 🔄 ナビゲーション改善
- **戻るボタンの最適化**: 
  - ペルソナ作成後、ログイン後、会員登録後に `router.replace()` を使用
  - 戻るボタンでフォームページに戻らないよう改善

### 🐛 バグ修正
- プロフィールページでの本人確認ロジック改善
- OAuth専用ユーザーのパスワード変更メニュー非表示化
- Netlify環境でのトランザクションエラー修正
- Prismaモデル名の大文字/小文字問題解決
- チャットリストの検索機能実装
- 管理者ページのユーザー停止状態表示修正
