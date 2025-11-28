// Cloudflare Images APIを使用した画像アップロードヘルパー関数

/**
 * Cloudflare Imagesに画像をアップロード
 * @param file アップロードするファイル (File または Buffer)
 * @param metadata オプションメタデータ
 * @returns アップロードされた画像の公開URL
 */
export async function uploadImageToCloudflare(
  file: File | Buffer,
  metadata?: {
    filename?: string;
    contentType?: string;
  }
): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_IMAGES_API_TOKEN;

  if (!accountId || !apiToken) {
    const errorMessage = `
❌ Cloudflare環境変数が設定されていません。

必要な環境変数:
  - CLOUDFLARE_ACCOUNT_ID
  - CLOUDFLARE_API_TOKEN (または CLOUDFLARE_IMAGES_API_TOKEN)

設定方法:
1. Cloudflare DashboardでAccount IDを確認
2. API Tokenを生成 (Images:Edit権限が必要)
3. .env.localファイルに追加:
   CLOUDFLARE_ACCOUNT_ID=your-account-id
   CLOUDFLARE_API_TOKEN=your-api-token
    `.trim();

    if (typeof window === 'undefined') {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage);
      throw new Error('Cloudflare環境変数が設定されていません。');
    }
  }

  // FileオブジェクトをFormDataに変換
  const formData = new FormData();
  
  if (file instanceof File) {
    formData.append('file', file);
    console.log(`[Cloudflare Upload] アップロード開始: ${file.name} (${Math.round(file.size / 1024)}KB)`);
  } else {
    // Bufferの場合はBlobに変換
    const blob = new Blob([file], { 
      type: metadata?.contentType || 'image/jpeg' 
    });
    const filename = metadata?.filename || `image-${Date.now()}.jpg`;
    formData.append('file', blob, filename);
    console.log(`[Cloudflare Upload] アップロード開始: ${filename} (${Math.round(file.length / 1024)}KB)`);
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('[Cloudflare Upload] エラー:', errorMessage, errorData);
      throw new Error(`画像アップロード失敗: ${errorMessage}`);
    }

    const data = await response.json();
    
    // Cloudflare Images API応答形式:
    // {
    //   "result": {
    //     "id": "image-id",
    //     "filename": "filename.jpg",
    //     "variants": [
    //       "https://imagedelivery.net/{account-hash}/{image-id}/public"
    //     ]
    //   }
    // }
    const imageUrl = data.result?.variants?.[0];

    if (!imageUrl) {
      console.error('[Cloudflare Upload] 応答データ:', data);
      throw new Error('画像URLを取得できません。API応答にvariantsがありません。');
    }
    
    console.log(`[Cloudflare Upload] 成功: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('[Cloudflare Upload] 例外発生:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('画像アップロード中に予期しないエラーが発生しました。');
  }
}

/**
 * クライアントサイドで使用するアップロード関数 (Fileオブジェクト用)
 * APIルート経由でアップロードしてAPIトークンを露出しない
 */
export async function uploadImageToStorage(file: File): Promise<string> {
  // クライアントサイドではAPIルート経由でアップロード
  if (typeof window !== 'undefined') {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`画像アップロード失敗: ${errorMessage}`);
    }

    const data = await response.json();
    return data.imageUrl;
  }

  // サーバーサイドでは直接アップロード
  return uploadImageToCloudflare(file);
}

/**
 * サーバーサイドで使用するアップロード関数 (Buffer用)
 */
export async function uploadImageBufferToCloudflare(
  buffer: Buffer,
  options?: {
    filename?: string;
    contentType?: string;
  }
): Promise<string> {
  return uploadImageToCloudflare(buffer, options);
}

/**
 * Cloudflare Images URLから画像IDを抽出
 * URL形式: https://imagedelivery.net/{account-hash}/{image-id}/public
 * @param imageUrl Cloudflare Images URL
 * @returns 画像IDまたはnull
 */
export function extractImageIdFromUrl(imageUrl: string): string | null {
  try {
    // https://imagedelivery.net/{account-hash}/{image-id}/public 形式
    const match = imageUrl.match(/imagedelivery\.net\/[^/]+\/([^/]+)\//);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('[Cloudflare] URLから画像ID抽出失敗:', error);
    return null;
  }
}

/**
 * Cloudflare Imagesから画像を削除
 * @param imageUrl Cloudflare Images URLまたは画像ID
 * @returns 削除成功可否
 */
export async function deleteImageFromCloudflare(imageUrl: string): Promise<boolean> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_IMAGES_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error('[Cloudflare Delete] 環境変数が設定されていません。');
    return false;
  }

  // URLから画像IDを抽出
  let imageId: string;
  if (imageUrl.startsWith('https://imagedelivery.net/')) {
    const extractedId = extractImageIdFromUrl(imageUrl);
    if (!extractedId) {
      console.error('[Cloudflare Delete] URLから画像IDを抽出できません:', imageUrl);
      return false;
    }
    imageId = extractedId;
  } else {
    // 既にIDの場合
    imageId = imageUrl;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`;
      console.error('[Cloudflare Delete] 削除失敗:', errorMessage, errorData);
      return false;
    }

    const data = await response.json();
    if (data.success) {
      console.log(`[Cloudflare Delete] 成功: ${imageId}`);
      return true;
    } else {
      console.error('[Cloudflare Delete] API応答失敗:', data);
      return false;
    }
  } catch (error) {
    console.error('[Cloudflare Delete] 例外発生:', error);
    return false;
  }
}

/**
 * Cloudflare Images URLかどうかを確認
 * @param url 確認するURL
 * @returns Cloudflare Images URLかどうか
 */
export function isCloudflareImageUrl(url: string): boolean {
  return url.startsWith('https://imagedelivery.net/');
}

