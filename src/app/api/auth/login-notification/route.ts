export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { sendLoginNotification } from '@/lib/security/login-notifications';

/**
 * ログイン通知を送信するAPI
 * POST /api/auth/login-notification
 * ログイン成功後にクライアントから呼び出される
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    await sendLoginNotification(userId, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Login Notification API] エラー:', error);
    // 通知エラーはクライアントに影響を与えない
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

