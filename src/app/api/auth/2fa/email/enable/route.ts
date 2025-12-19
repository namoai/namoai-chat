export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * 이메일 기반 2FA 활성화
 * POST /api/auth/2fa/email/enable
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
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
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    // 既に2FAが有効かチェック
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FAは既に有効化されています。' },
        { status: 400 }
      );
    }

    // 이메일 기반 2FA 활성화 (twoFactorSecret은 null로 설정, 이메일로 코드 전송)
    await prisma.users.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: null, // 이메일 기반이므로 TOTP secret 불필요
        twoFactorBackupCodes: [], // 이메일 기반이므로 백업 코드 불필요
      },
    });

    return NextResponse.json({
      message: '2FA（メール認証）が有効化されました。次回ログイン時からメール認証コードが必要になります。',
    });
  } catch (error) {
    console.error('[Enable Email 2FA] エラー:', error);
    return NextResponse.json(
      { error: '2FA有効化中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


