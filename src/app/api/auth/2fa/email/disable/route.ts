export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * 이메일 기반 2FA 비활성화
 * POST /api/auth/2fa/email/disable
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const prisma = await getPrisma();

    // ユーザーを取得
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    // 2FAが無効かチェック
    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FAは既に無効化されています。' },
        { status: 400 }
      );
    }

    // 2FA 비활성화
    await prisma.users.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    return NextResponse.json({
      message: '2FA（メール認証）が無効化されました。',
    });
  } catch (error) {
    console.error('[Disable Email 2FA] エラー:', error);
    return NextResponse.json(
      { error: '2FA無効化中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


