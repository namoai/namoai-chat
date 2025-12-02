# Cloudflare R2 実装概要

## 📋 実装内容

このプロジェクトでは、画像ストレージとして **Cloudflare R2 (S3互換オブジェクトストレージ)** を使用しています。

### 主な機能

1. **画像アップロード**
   - クライアントサイド: `/api/upload-image` APIルート経由でアップロード
   - サーバーサイド: `uploadImageBufferToCloudflare()` 関数で直接アップロード
   - ファイル検証: サイズ制限(5MB)、MIMEタイプ、マジックナンバー検証
   - 自動ファイル名サニタイズ: UUID付き安全なファイル名を自動生成

2. **画像削除**
   - `deleteImageFromCloudflare()` 関数でR2から画像を削除
   - URLから自動的にキーを抽出して削除

3. **セキュリティ**
   - 認証必須: すべてのアップロードは認証済みユーザーのみ
   - CSRF保護: クライアントサイドアップロードはCSRFトークン必須
   - 環境変数保護: Access Key/Secretはサーバーサイドのみで使用

## 🔧 実装ファイル

### コア実装
- **`src/lib/cloudflare-images.ts`**: R2アップロード/削除のヘルパー関数
  - `uploadImageToCloudflare()`: File/Blob/BufferをR2にアップロード
  - `uploadImageBufferToCloudflare()`: Buffer専用アップロード関数
  - `deleteImageFromCloudflare()`: R2から画像を削除
  - `isCloudflareImageUrl()`: R2 URLかどうかを判定

### APIルート
- **`src/app/api/upload-image/route.ts`**: クライアントサイドアップロード用API
  - 認証チェック
  - 画像ファイル検証
  - R2へのアップロード処理

### 使用箇所
- キャラクター画像: `src/app/api/characters/route.ts`, `src/app/api/characters/[id]/route.ts`
- プロフィール画像: `src/app/api/users/profile/route.ts`
- 画像生成API: `1024/route.ts`
- キャラクターインポート: `src/app/api/characters/[id]/import/route.ts`

## 💻 技術仕様

### 使用ライブラリ
- **`@aws-sdk/client-s3`**: S3互換APIでR2にアクセス
- 遅延ロード: サーバーサイドでのみ動的インポート

### アップロードフロー
1. クライアント → `/api/upload-image` (FormData + CSRF)
2. APIルート → 認証 + ファイル検証
3. `uploadImageBufferToCloudflare()` → S3 SDKでR2にアップロード
4. 公開URLを返却 → データベースに保存

### 削除フロー
1. 画像URLからR2キーを抽出
2. `deleteImageFromCloudflare()` → S3 SDKでR2から削除

## 🔐 環境変数

```bash
CLOUDFLARE_ACCOUNT_ID=cf-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret-key
CLOUDFLARE_R2_BUCKET_NAME=chat-images
CLOUDFLARE_R2_PUBLIC_URL=https://chat-images.<account-id>.r2.cloudflarestorage.com
```

## ✅ 実装済み機能

- ✅ 画像アップロード (File/Blob/Buffer対応)
- ✅ 画像削除
- ✅ ファイル検証 (サイズ、MIMEタイプ、マジックナンバー)
- ✅ ファイル名サニタイズ
- ✅ エラーハンドリング
- ✅ クライアント/サーバー両対応
- ✅ セキュリティ (認証、CSRF保護)

## 🚀 今後の改善予定

- [ ] 画像リサイズ/最適化パイプライン (sharp等)
- [ ] 既存画像のR2へのマイグレーション
- [ ] カスタムドメイン接続 + キャッシュ設定

