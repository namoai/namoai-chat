# Google Cloud OAuth ドメイン設定ガイド

## 概要

新しい Amplify アプリを使用する際、Google Cloud Console で OAuth 設定を更新する必要があります。

## 必須設定項目

### 1. OAuth 2.0 クライアント ID 設定

**パス**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

#### 承認済みリダイレクト URI (Authorized redirect URIs)

次の形式の URI を追加する必要があります:

```
https://{your-domain}/api/auth/callback/google
```

**例**:
- メインアプリ: `https://main.yourdomain.com/api/auth/callback/google`
- 新規アプリ: `https://new.yourdomain.com/api/auth/callback/google`
- または Amplify ドメイン: `https://{branch}.{app-id}.amplifyapp.com/api/auth/callback/google`

#### 承認済み JavaScript オリジン (Authorized JavaScript origins)

次の形式のドメインを追加する必要があります:

```
https://{your-domain}
```

**例**:
- メインアプリ: `https://main.yourdomain.com`
- 新規アプリ: `https://new.yourdomain.com`
- または Amplify ドメイン: `https://{branch}.{app-id}.amplifyapp.com`

### 2. OAuth 同意画面設定

**パス**: Google Cloud Console → APIs & Services → OAuth consent screen

#### 承認済みドメイン (Authorized domains)

アプリケーションドメインを追加する必要があります:

- `yourdomain.com` (ルートドメイン)
- または `amplifyapp.com` (Amplify デフォルトドメイン使用時)

**注意**: サブドメインは自動的に含まれますが、明示的に追加することをお勧めします。

### 3. API キー制限 (API キーを使用する場合)

**パス**: Google Cloud Console → APIs & Services → Credentials → API Keys

API キーを使用する場合、HTTP リファラー（ウェブサイト）制限に以下を追加:

```
https://{your-domain}/*
```

## 設定確認方法

### 1. 現在の設定確認

Google Cloud Console で:
1. **APIs & Services** → **Credentials**
2. OAuth 2.0 Client ID をクリック
3. **Authorized redirect URIs** および **Authorized JavaScript origins** を確認

### 2. テスト

1. 新規アプリで Google ログインを試行
2. ブラウザ開発者ツール → Network タブで確認:
   - `redirect_uri_mismatch` エラーが発生した場合、リダイレクト URI が不足している
   - `origin_mismatch` エラーが発生した場合、JavaScript オリジンが不足している

## 問題解決

### エラー: `redirect_uri_mismatch`

**原因**: 承認済みリダイレクト URI に新しいドメインが追加されていない

**解決方法**:
1. Google Cloud Console → OAuth 2.0 Client ID
2. **Authorized redirect URIs** に新しいドメインを追加
3. 形式: `https://{new-domain}/api/auth/callback/google`

**重要**: 
- 各環境（main、develop など）のドメインを個別に追加する必要があります
- ワイルドカードは使用できません
- プロトコル（https://）を含める必要があります
- 末尾のスラッシュは不要です

**現在のドメインを確認する方法**:
1. CloudWatch ログで `[NextAuth] Google OAuth redirect URI:` を検索
2. または、ブラウザの開発者ツール → Network タブで Google OAuth リクエストを確認

### エラー: `origin_mismatch`

**原因**: 承認済み JavaScript オリジンに新しいドメインが追加されていない

**解決方法**:
1. Google Cloud Console → OAuth 2.0 Client ID
2. **Authorized JavaScript origins** に新しいドメインを追加
3. 形式: `https://{new-domain}` (プロトコルを含む、パスは除外)

### CSRF トークンエラー

**原因**: `NEXTAUTH_URL` 環境変数が新しいドメインに設定されていない

**解決方法**:
1. Amplify Console → Environment variables
2. `NEXTAUTH_URL` を新しいドメインに設定
   - 例: `https://{new-domain}`
3. アプリを再デプロイ

## 重要事項

1. **ドメイン変更時**: 新しいドメインを Google Cloud Console に追加する必要があります
2. **環境変数**: `NEXTAUTH_URL` が実際のドメインと一致する必要があります
3. **HTTPS 必須**: 本番環境では HTTPS のみ使用可能です
4. **ワイルドカード不可**: Google はワイルドカードをサポートしていないため、各ドメインを個別に追加する必要があります
5. **各環境ごとに追加**: main、develop、その他のブランチごとに個別のドメインを追加する必要があります

## 現在のドメインを確認する方法

### 方法 1: CloudWatch ログを確認

1. AWS Amplify Console → アプリ → Monitoring → View logs
2. ログで以下を検索: `[NextAuth] Google OAuth redirect URI:`
3. 表示された URI を Google Cloud Console に追加

### 方法 2: ブラウザ開発者ツールで確認

1. Google ログインボタンをクリック
2. ブラウザ開発者ツール → Network タブを開く
3. Google OAuth リクエストを確認
4. `redirect_uri` パラメータの値を確認
5. その値を Google Cloud Console の「Authorized redirect URIs」に追加

## 参考

- NextAuth はデフォルトで `/api/auth/callback/{provider}` パスを使用します
- Google OAuth は `sameSite: 'strict'` クッキーを使用するため、ドメインが正確に一致する必要があります
- CSRF トークンはドメインごとに生成されるため、ドメインが異なるとトークンが検証されません
