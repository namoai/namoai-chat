export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { validateImageFile } from '@/lib/upload/validateImage';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { uploadImageBufferToCloudflare } from '@/lib/cloudflare-images';
import { logApiAccess } from '@/lib/log-access';
import { sanitizeString } from '@/lib/validation';
import bcrypt from 'bcrypt';



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
      select: { nickname: true, bio: true, image: true, twoFactorEnabled: true, phone: true, password: true },
    });
    if (!ユーザー) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json({
      nickname: ユーザー.nickname,
      bio: ユーザー.bio,
      image: ユーザー.image ?? null,
      image_url: ユーザー.image ?? null,
      twoFactorEnabled: ユーザー.twoFactorEnabled ?? false,
      phone: ユーザー.phone ?? '',
      hasPassword: !!ユーザー.password, // Googleアカウント有無確認（パスワードがあればメール/パスワードログイン可能）
    });
  } catch (エラー) {
    console.error('プロファイル取得エラー:', エラー);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


// PUT: ユーザーのプロフィール情報を更新します
export async function PUT(リクエスト: Request) {
  if (isBuildTime()) return buildTimeResponse();

  const startTime = Date.now();
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
    const 電話番号 = フォームデータ.get('phone') as string | null;
    const 画像ファイル = フォームデータ.get('image') as File | null;
    const パスワード確認 = フォームデータ.get('password') as string | null;

    // パスワード確認必須
    if (!パスワード確認 || パスワード確認.trim().length === 0) {
      return NextResponse.json({ error: 'パスワードを入力してください。' }, { status: 400 });
    }

    // 現在のパスワード検証
    const ユーザー = await prisma.users.findUnique({
      where: { id: ユーザーID },
      select: { password: true },
    });

    if (!ユーザー || !ユーザー.password) {
      return NextResponse.json({ error: 'パスワードが設定されていないアカウントです。' }, { status: 400 });
    }

    const isPasswordValid = await bcrypt.compare(パスワード確認, ユーザー.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'パスワードが正しくありません。' }, { status: 401 });
    }

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

    // フォームデータの検証とサニタイズ
    const サニタイズ済みニックネーム = sanitizeString(ニックネーム);
    const サニタイズ済み自己紹介 = 自己紹介 ? sanitizeString(自己紹介) : null;
    const サニタイズ済み電話番号 = 電話番号 && 電話番号.trim() ? sanitizeString(電話番号.trim()) : null;

    // ニックネーム重複確認（他のユーザーが使用中の場合）
    const 既存ニックネーム = await prisma.users.findFirst({
      where: {
        nickname: サニタイズ済みニックネーム,
        NOT: { id: ユーザーID },
      },
    });
    if (既存ニックネーム) {
      return NextResponse.json(
        { error: 'このニックネームは既に使用されています。' },
        { status: 409 }
      );
    }

    // 電話番号の重複チェック（他のユーザーが使用している場合）
    if (サニタイズ済み電話番号) {
      const 既存ユーザー = await prisma.users.findFirst({
        where: {
          phone: サニタイズ済み電話番号,
          NOT: { id: ユーザーID },
        },
      });
      if (既存ユーザー) {
        return NextResponse.json(
          { error: 'この電話番号は既に使用されています。' },
          { status: 409 }
        );
      }
    }

    const 更新後のユーザー = await prisma.users.update({
      where: { id: ユーザーID },
      data: {
        nickname: サニタイズ済みニックネーム,
        bio: サニタイズ済み自己紹介,
        phone: サニタイズ済み電話番号,
        // 画像URLが存在する場合のみ、データを更新
        ...(画像URL ? { image: 画像URL } : {}),
      },
    });

    const response = NextResponse.json({ message: 'プロフィールが正常に更新されました。', user: 更新後のユーザー });
    
    // Log API access directly (more reliable than middleware fetch in AWS environments)
    logApiAccess(リクエスト, {
      statusCode: 200,
      duration: Date.now() - startTime,
      userId: ユーザーID,
    }).catch(() => {}); // Non-blocking
    
    return response;

  } catch (エラー) {
    console.error('プロファイル更新エラー:', エラー);
    if (エラー instanceof Prisma.PrismaClientKnownRequestError && エラー.code === 'P2002') {
      return NextResponse.json(
        { error: 'このニックネームは既に使用されています。' },
        { status: 409 }
      );
    }
    const errorResponse = NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
    
    // Log API access even on error
    logApiAccess(リクエスト, {
      statusCode: 500,
      duration: Date.now() - startTime,
      userId: ユーザーID,
    }).catch(() => {}); // Non-blocking
    
    return errorResponse;
  }
}