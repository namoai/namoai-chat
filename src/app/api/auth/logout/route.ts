export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * ログアウトAPI - Refresh Token無効化
 * POST /api/auth/logout
 * 
 * ログアウト時にrefresh tokenを明示的に無効化します。
 * NextAuthのevents.signOutがJWT戦略で正しく動作しない場合のフォールバックとして使用。
 */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      // セッションがない場合でも成功として返す（既にログアウト済み）
      return NextResponse.json({ success: true, message: '既にログアウト済みです' });
    }

    const userId = parseInt(session.user.id, 10);
    
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: '無効なユーザーIDです' }, { status: 400 });
    }

    // ユーザーのAccountレコードからrefresh tokenを無効化
    const updateResult = await prisma.account.updateMany({
      where: { userId: userId },
      data: { 
        refresh_token: null,
        access_token: null,
        expires_at: null,
      },
    });

    console.log(`[logout API] ユーザー ID ${userId} のrefresh tokenを無効化しました (更新件数: ${updateResult.count})`);

    return NextResponse.json({ 
      success: true, 
      message: 'ログアウトしました',
      tokensInvalidated: updateResult.count > 0
    });
  } catch (error) {
    console.error('[logout API] refresh token無効化エラー:', error);
    // エラーが発生しても成功として返す（ログアウト処理は続行）
    return NextResponse.json({ 
      success: true, 
      message: 'ログアウト処理を完了しました',
      warning: 'refresh tokenの無効化に失敗しましたが、ログアウトは完了しています'
    });
  }
}


