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

    // Cloudflare Imagesにアップロード
    const imageUrl = await uploadImageToCloudflare(file);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('[Upload Image API] エラー:', error);
    const message = error instanceof Error ? error.message : '画像アップロード中にエラーが発生しました。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

