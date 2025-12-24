export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPointBalance } from '@/lib/point-manager';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

// ユーザーの詳細ポイント残高を取得（有効期限付き）
export async function GET() {
  await ensureEnvVarsLoaded();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const balance = await getPointBalance(userId);

    return NextResponse.json({
      totalFreePoints: balance.totalFreePoints,
      totalPaidPoints: balance.totalPaidPoints,
      totalPoints: balance.totalPoints,
      details: balance.details.map((d) => ({
        id: d.id,
        type: d.type,
        balance: d.balance,
        expiresAt: d.expiresAt,
        source: d.source,
      })),
    });
  } catch (error) {
    console.error('ポイント残高取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}


