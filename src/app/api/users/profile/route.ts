export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { validateImageFile } from '@/lib/upload/validateImage';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { uploadImageBufferToCloudflare } from '@/lib/cloudflare-images';



// GET: 現在ログインしているユーザーのプロフィール情報を取得します
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const prisma = await getPrisma();
  const セッション = await getServerSession(authOptions);
  if (!セッション?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const ユーザーID = parseInt(セッション.user.id, 10);
  try {
    const ユーザー = await prisma.users.findUnique({
      where: { id: ユーザーID },
      // Prisma field name is `image` (mapped to DB column `image_url`)
      select: { nickname: true, bio: true, image: true },
    });
    if (!ユーザー) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json({
      nickname: ユーザー.nickname,
      bio: ユーザー.bio,
      image: ユーザー.image ?? null,
      image_url: ユーザー.image ?? null,
    });
  } catch (エラー) {
    console.error('プロファイル取得エラー:', エラー);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


// PUT: ユーザーのプロフィール情報を更新します
export async function PUT(リクエスト: Request) {
  if (isBuildTime()) return buildTimeResponse();

  const prisma = await getPrisma();
  const セッション = await getServerSession(authOptions);
  if (!セッション?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const ユーザーID = parseInt(セッション.user.id, 10);

  try {
    const フォームデータ = await リクエスト.formData();
    const ニックネーム = フォームデータ.get('nickname') as string;
    const 自己紹介 = フォームデータ.get('bio') as string;
    const 画像ファイル = フォームデータ.get('image') as File | null;

    let 画像URL: string | undefined = undefined;

    if (画像ファイル && 画像ファイル.size > 0) {
      let validatedImage;
      try {
        validatedImage = await validateImageFile(画像ファイル, { maxSizeBytes: 3 * 1024 * 1024 });
      } catch (error) {
        const message = error instanceof Error ? error.message : '画像検証中にエラーが発生しました。';
        return NextResponse.json({ message }, { status: 400 });
      }

      try {
        画像URL = await uploadImageBufferToCloudflare(validatedImage.buffer, {
          filename: validatedImage.safeFileName,
          contentType: validatedImage.mimeType,
        });
        console.log(`[PUT] プロフィール画像アップロード成功: ${画像URL}`);
      } catch (uploadError) {
        console.error(`[PUT] Cloudflareアップロード失敗:`, uploadError);
        const message = uploadError instanceof Error ? uploadError.message : '画像アップロードに失敗しました。';
        return NextResponse.json({ message: `画像アップロードに失敗しました: ${message}` }, { status: 500 });
      }
    }

    const 更新後のユーザー = await prisma.users.update({
      where: { id: ユーザーID },
      data: {
        nickname: ニックネーム,
        bio: 自己紹介,
        // 画像URLが存在する場合のみ、データを更新
        ...(画像URL ? { image: 画像URL } : {}),
      },
    });

    return NextResponse.json({ message: 'プロフィールが正常に更新されました。', user: 更新後のユーザー });

  } catch (エラー) {
    console.error('プロファイル更新エラー:', エラー);
    if (エラー instanceof Prisma.PrismaClientKnownRequestError && エラー.code === 'P2002') {
      return NextResponse.json(
        { error: 'このニックネームは既に使用されています。' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}