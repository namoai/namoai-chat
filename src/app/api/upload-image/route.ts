// クライアントサイドから画像をアップロードするためのAPIルート
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { uploadImageToCloudflare } from '@/lib/cloudflare-images';

export async function POST(request: NextRequest) {
  try {
    // 認証確認
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが提供されていません。' }, { status: 400 });
    }

    // 環境変数の確認（デバッグ用）
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_IMAGES_API_TOKEN;
    console.log('[Upload Image API] 環境変数確認:', {
      hasAccountId: !!accountId,
      hasApiToken: !!apiToken,
      accountIdPreview: accountId ? `${accountId.substring(0, 8)}...` : '未設定',
      apiTokenPreview: apiToken ? `${apiToken.substring(0, 8)}...` : '未設定',
    });

    // Cloudflare Imagesにアップロード
    const imageUrl = await uploadImageToCloudflare(file);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('[Upload Image API] エラー:', error);
    let message = '画像アップロード中にエラーが発生しました。';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = JSON.stringify(error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

