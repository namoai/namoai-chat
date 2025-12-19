export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { safeJsonParse } from '@/lib/api-helpers';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

const CODE_TTL_MINUTES = 10; // 10分間有効

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code: string): string {
  // SHA-256ハッシュを使用（既存のverify-code APIと同じ方式）
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * 로그인 시 2FA 이메일 코드 전송
 * POST /api/auth/2fa/email/send-code
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const parseResult = await safeJsonParse<{ email: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { email } = parseResult.data;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'メールアドレスが無効です。' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const prisma = await getPrisma();

    // ユーザーを確認
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, twoFactorEnabled: true },
    });

    if (!user) {
      // ユーザーが存在しない場合でも、セキュリティのため同じレスポンスを返す
      return NextResponse.json({ message: '認証コードを送信しました。' }, { status: 200 });
    }

    // 2FA가 활성화되지 않은 경우
    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FAが有効化されていません。' }, { status: 400 });
    }

    // 既存のコードを無効化
    await prisma.verificationToken.deleteMany({
      where: { identifier: `2fa_code:${normalizedEmail}` },
    });

    // 6桁コード生成
    const code = generate6DigitCode();
    const token = hashCode(code);
    const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    // データベースに保存
    await prisma.verificationToken.create({
      data: {
        identifier: `2fa_code:${normalizedEmail}`,
        token,
        expires,
      },
    });

    // メール送信
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'ログイン認証コード（2FA）',
        text: `ログイン認証コード: ${code}\n有効期限: ${CODE_TTL_MINUTES}分\n\nこのコードをログイン画面に入力してください。`,
      });
    } catch (mailErr: unknown) {
      console.error('2FA code email send error:', mailErr);
      return NextResponse.json(
        { error: 'メール送信に失敗しました。しばらくしてから再試行してください。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: '認証コードを送信しました。' }, { status: 200 });
  } catch (error) {
    console.error('[Send 2FA Code] エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}


