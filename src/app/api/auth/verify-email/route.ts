import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * メール認証API
 * GET /api/auth/verify-email?token=xxx&email=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.json(
        { error: 'トークンとメールアドレスが必要です。' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // トークンを検証
    const verificationToken = await prisma.email_verification_tokens.findFirst({
      where: {
        token,
        email,
        expires: {
          gt: new Date(), // 有効期限内
        },
      },
      include: {
        users: true,
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: '無効または期限切れのトークンです。' },
        { status: 400 }
      );
    }

    // 既に認証済みかチェック
    if (verificationToken.users.emailVerified) {
      // トークンを削除してからリダイレクト
      await prisma.email_verification_tokens.delete({
        where: { id: verificationToken.id },
      });
      return NextResponse.redirect(
        new URL('/login?verified=true', request.url)
      );
    }

    // メールアドレスを認証
    await prisma.$transaction([
      prisma.users.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: new Date(),
        },
      }),
      // 使用済みトークンを削除
      prisma.email_verification_tokens.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    // ログインページにリダイレクト
    return NextResponse.redirect(new URL('/login?verified=true', request.url));
  } catch (error) {
    console.error('[Verify Email] エラー:', error);
    return NextResponse.json(
      { error: 'メール認証中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * 認証メール再送信API
 * POST /api/auth/verify-email/resend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスが必要です。' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // ユーザーを検索
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      // セキュリティのため、ユーザーが存在しない場合でも成功レスポンスを返す
      return NextResponse.json({
        message: 'メールアドレスに認証リンクを送信しました。',
      });
    }

    // 既に認証済みかチェック
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に認証済みです。' },
        { status: 400 }
      );
    }

    // 新しいトークンを生成
    const token = randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // 24時間有効

    // 古いトークンを削除して新しいトークンを作成
    await prisma.$transaction([
      prisma.email_verification_tokens.deleteMany({
        where: { userId: user.id },
      }),
      prisma.email_verification_tokens.create({
        data: {
          userId: user.id,
          email: user.email,
          token,
          expires,
        },
      }),
    ]);

    // 認証メールを送信
    const { sendVerificationEmail } = await import('@/lib/email');
    await sendVerificationEmail(user.email, token);

    return NextResponse.json({
      message: '認証メールを再送信しました。',
    });
  } catch (error) {
    console.error('[Resend Verification Email] エラー:', error);
    return NextResponse.json(
      { error: 'メール送信中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}




