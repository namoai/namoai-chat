// クライアントサイド用 Supabase クライアント
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `
❌ Supabase環境変数が設定されていません。

必要な環境変数:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY

設定方法:
1. プロジェクトルートに .env.local ファイルを作成
2. 以下の形式で環境変数を追加:

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

詳細は SETUP_ENV.md を参照してください。
  `.trim();
  
  if (typeof window === 'undefined') {
    // サーバーサイド: エラーをスロー
    throw new Error(errorMessage);
  } else {
    // クライアントサイド: コンソールに警告を表示
    console.error(errorMessage);
    throw new Error('Supabase環境変数が設定されていません。.env.localファイルを確認してください。');
  }
}

// ブラウザから直接Supabase Storageにアクセスするためのクライアント
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// 画像アップロード用のヘルパー関数 (Cloudflare R2)
export { uploadImageToStorage } from './cloudflare-images';

