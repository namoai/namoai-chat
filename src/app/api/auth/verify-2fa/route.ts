export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { verify2FACode } from '@/lib/2fa';
import { safeJsonParse } from '@/lib/api-helpers';

/**
 * 2FAコード検証API
 * POST /api/auth/verify-2fa
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const parseResult = await safeJsonParse<{ code: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { code } = parseResult.data;

    if (!code || code.length < 6) {
      return NextResponse.json({ error: '2FAコードが必要です。' }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);
    const result = await verify2FACode(userId, code);

    if (!result.valid) {
      return NextResponse.json({ error: '2FAコードが正しくありません。' }, { status: 401 });
    }

    // セッションに2FA検証済みフラグを設定（JWTに含める）
    // 実際には、セッション更新が必要ですが、NextAuthの制限により
    // クライアント側でセッションを再取得する必要があります

    return NextResponse.json({
      success: true,
      usedBackupCode: result.usedBackupCode,
      message: result.usedBackupCode
        ? 'バックアップコードを使用しました。'
        : '2FA認証が完了しました。',
    });
  } catch (error) {
    console.error('[Verify 2FA] エラー:', error);
    return NextResponse.json(
      { error: '2FA検証中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

