import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 認証コード検証API
 * POST /api/auth/verify-code
 * Body: { email: string, code: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: 'メールアドレスと認証コードが必要です。' },
        { status: 400 }
      );
    }

    // 認証コードは6桁の数字
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: '認証コードは6桁の数字です。' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // 認証コードを検証
    const verificationToken = await prisma.email_verification_tokens.findFirst({
      where: {
        email,
        token: code,
        expires: {
          gt: new Date(), // 有効期限内
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: '認証コードが正しくないか、期限切れです。' },
        { status: 400 }
      );
    }

    // 既存ユーザーかどうかを確認（emailでユーザーを検索）
    const user = await prisma.users.findUnique({
      where: { email },
    });

    // 既存ユーザーの場合、メールアドレスを認証済みに更新
    if (user) {
      await prisma.$transaction([
        prisma.users.update({
          where: { id: user.id },
          data: {
            emailVerified: new Date(),
          },
        }),
        // 使用済みトークンを削除
        prisma.email_verification_tokens.delete({
          where: { id: verificationToken.id },
        }),
      ]);
    } else {
      // まだ登録されていない場合、トークンを削除（認証完了状態をセッション等で管理）
      // 実際には認証完了をフロントエンドで管理し、会員登録時に確認します
      await prisma.email_verification_tokens.delete({
        where: { id: verificationToken.id },
      });
    }

    return NextResponse.json({
      message: 'メールアドレスの認証が完了しました。',
      verified: true,
    });
  } catch (error) {
    console.error('[Verify Code] エラー:', error);
    return NextResponse.json(
      { error: '認証コード検証中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

