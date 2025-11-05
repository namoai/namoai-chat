// クライアントサイド用 Supabase クライアント
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase環境変数が設定されていません。NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。');
}

// ブラウザから直接Supabase Storageにアクセスするためのクライアント
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// 画像アップロード用のヘルパー関数
export async function uploadImageToStorage(file: File, bucket: string = 'characters'): Promise<string> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
  const objectKey = `uploads/${fileName}`;

  console.log(`[Supabase Upload] アップロード開始: ${file.name} (${Math.round(file.size / 1024)}KB)`);

  const { error } = await supabaseClient.storage
    .from(bucket)
    .upload(objectKey, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('[Supabase Upload] エラー:', error);
    throw new Error(`画像アップロード失敗: ${error.message}`);
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(objectKey);

  console.log(`[Supabase Upload] 成功: ${publicUrl}`);
  return publicUrl;
}

