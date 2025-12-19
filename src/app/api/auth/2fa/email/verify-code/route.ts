export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { safeJsonParse } from '@/lib/api-helpers';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import crypto from 'crypto';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * 로그인 시 2FA 이메일 코드 검증
 * POST /api/auth/2fa/email/verify-code
 * Body: { email: string, code: string }
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const parseResult = await safeJsonParse<{ email: string; code: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { email, code } = parseResult.data;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'メールアドレスが無効です。' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: '認証コードは6桁の数字です。' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const prisma = await getPrisma();

    // コードレコードを取得
    const record = await prisma.verificationToken.findFirst({
      where: { identifier: `2fa_code:${normalizedEmail}` },
      orderBy: { expires: 'desc' },
    });

    if (!record) {
      return NextResponse.json(
        { error: '認証コードが見つかりません。再送信してください。' },
        { status: 400 }
      );
    }

    if (record.expires < new Date()) {
      await prisma.verificationToken.deleteMany({ where: { identifier: `2fa_code:${normalizedEmail}` } });
      return NextResponse.json(
        { error: '認証コードの有効期限が切れています。再送信してください。' },
        { status: 400 }
      );
    }

    // コード検証
    const expected = record.token;
    const actual = hashCode(code);
    if (expected !== actual) {
      return NextResponse.json({ error: '認証コードが正しくありません。' }, { status: 400 });
    }

    // コード使用（削除）
    await prisma.verificationToken.deleteMany({ where: { identifier: `2fa_code:${normalizedEmail}` } });

    // ユーザーを確認
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json({ error: '2FAが有効化されていません。' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      userId: user.id,
      message: '認証コードが確認されました。',
    });
  } catch (error) {
    console.error('[Verify 2FA Code] エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}


