# 🔧 환경 변수 설정 가이드

## 📋 필수 환경 변수

### 1️⃣ **Supabase Storage (クライアントサイド直接アップロード用)**

ブラウザから直接Supabase Storageに画像をアップロードするために、以下の環境変数が必要です:

```bash
# .env.local に追加
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### **Supabase Anon Keyの取得方法**

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. プロジェクトを選択
3. 左サイドバーの **Settings** → **API** に移動
4. **Project API keys** セクションで `anon` `public` キーをコピー

### 2️⃣ **Netlify環境変数設定**

Netlify Dashboardで以下の環境変数を追加してください:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔒 セキュリティ設定

### **Supabase Storage Policies (重要!)**

ブラウザから直接アップロードを許可するため、Supabase Storageのポリシーを設定する必要があります:

1. Supabase Dashboard → **Storage** → **Policies**
2. `characters` バケットを選択
3. 以下のポリシーを追加:

#### **アップロードポリシー (INSERT)**

```sql
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'characters' AND
  (storage.foldername(name))[1] = 'uploads'
);
```

#### **公開読み取りポリシー (SELECT)**

```sql
CREATE POLICY "Public can read images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'characters');
```

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

