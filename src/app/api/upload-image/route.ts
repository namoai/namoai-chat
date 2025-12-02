// クライアントサイドから画像をアップロードするためのAPIルート
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { uploadImageBufferToCloudflare } from '@/lib/cloudflare-images';
import { validateImageFile } from '@/lib/upload/validateImage';

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

    // 画像ファイルの検証（サイズ、MIMEタイプ、マジックナンバー）
    let validatedFile;
    try {
      validatedFile = await validateImageFile(file, { maxSizeBytes: 5 * 1024 * 1024 });
    } catch (err) {
      const message = err instanceof Error ? err.message : '画像検証中にエラーが発生しました。';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Cloudflare R2にアップロード
    const imageUrl = await uploadImageBufferToCloudflare(validatedFile.buffer, {
      filename: validatedFile.safeFileName,
      contentType: validatedFile.mimeType,
    });

    return NextResponse.json({ imageUrl });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Upload Image API] エラー:', error);
    }
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

