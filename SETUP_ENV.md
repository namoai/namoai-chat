# 🔧 環境変数設定ガイド

## 📋 必須環境変数

### 1️⃣ **Supabaseから値を取得**

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. 左サイドバーの **Settings** → **API** に移動
4. 以下2つをコピー:
   - **Project URL** (例: `https://abcdefgh.supabase.co`)
   - **anon public key** (例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 2️⃣ **Cloudflare R2の資格情報を取得**

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) で **R2** 메뉴 이동
2. 버킷 생성 (예: `chat-images`)
3. 버킷 → **Settings** → **Public bucket** 활성화 → 표시되는 Public URL 확인
4. 동일 페이지에서 **Custom Domain** (선택)을 연결하면 CDN 캐시 도메인 사용 가능
5. 버킷 목록 우측 상단 **Manage R2 API Tokens** → **Create API Token**
6. `Object Read & Write`, `Bucket Read` 권한을 포함한 토큰을 생성하고 **Access Key / Secret Key**를 복사

### 3️⃣ **ローカル開発環境設定** ⭐ 重要

プロジェクトルートに `.env.local` ファイルを作成し、以下を追加:

```bash
# .env.local
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=cf-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=secret-key
CLOUDFLARE_R2_BUCKET_NAME=chat-images
CLOUDFLARE_R2_PUBLIC_URL=https://chat-images.cf-account-id.r2.cloudflarestorage.com
# (optional) 커스텀 endpoint가 있을 때만 사용
# CLOUDFLARE_R2_ENDPOINT=https://cf-account-id.r2.cloudflarestorage.com
```

**💡 Note:** `.env.local` ファイルは `.gitignore` に含まれているため、Gitにコミットされません。

### 4️⃣ **Netlify環境変数設定** ⭐ 重要

Netlify Dashboard → Site configuration → Environment variables → **Add a variable** で以下を追加:

```
# Supabase
変数名: NEXT_PUBLIC_SUPABASE_URL
値: https://your-project.supabase.co

変数名: NEXT_PUBLIC_SUPABASE_ANON_KEY
値: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare R2
変数名: CLOUDFLARE_ACCOUNT_ID
値: cf-account-id

変数名: CLOUDFLARE_R2_ACCESS_KEY_ID
値: access-key

変数名: CLOUDFLARE_R2_SECRET_ACCESS_KEY
値: secret-key

変数名: CLOUDFLARE_R2_BUCKET_NAME
値: chat-images

変数名: CLOUDFLARE_R2_PUBLIC_URL
値: https://chat-images.cf-account-id.r2.cloudflarestorage.com

変数名: CLOUDFLARE_R2_ENDPOINT (任意)
値: https://cf-account-id.r2.cloudflarestorage.com
```

**💡 Note:** GSMではなくNetlify環境変数に追加してください。`NEXT_PUBLIC_*`変数はビルド時に必要で、公開されても安全です。`CLOUDFLARE_*`変数はサーバーサイドでのみ使用されます。

### 5️⃣ **AWS Amplify / Parameter Store 設定**

Amplify Hostingでデプロイする場合は、同じキーを **Amplify Environment variables** または **Systems Manager Parameter Store** (`/amplify/{appId}/{branch}/{KEY}`) に도 넣어야 Lambda 런타임에서 읽을 수 있습니다.

必須キー 목록:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_PROJECT_ID`
- `CLOUDFLARE_R2_ACCOUNT_ID` または `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME` (또는 `CLOUDFLARE_R2_BUCKET`)
- `CLOUDFLARE_R2_PUBLIC_URL`
- `CLOUDFLARE_R2_ENDPOINT` (커스텀 엔드포인트가 있을 때만)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

> ⚠️ Amplify 앱 ID가 기본값(`duvg1mvqbm4y4`)과 다르면, Amplify 콘솔의 **Environment variables**에 `AWS_APP_ID`(또는 `AWS_AMPLIFY_APP_ID`)와 `AWS_BRANCH`를 반드시 지정해 주세요. 지정하지 않으면 Lambda가 Parameter Store 경로를 찾지 못해 환경 변수를 불러오지 못합니다.

## ✅ 動作確認

環境変数が正しく設定されているか確認:

```bash
# ローカル開発環境
npm run dev

# ブラウザのコンソールで確認
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

## 🚀 メリット

- ✅ **無制限のアップロード**: Netlify Functionsの6MB/30MB制限を回避
- ✅ **高速アップロード**: サーバーを経由しないため高速
- ✅ **100枚以上対応**: 画像枚数制限なし
- ✅ **進行状況表示**: 各画像のアップロード状況をリアルタイム表示

## 📚 参考リンク

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase RLS Policies](https://supabase.com/docs/guides/storage/security/access-control)

