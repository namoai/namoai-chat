import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getReferralStats } from '@/lib/referral';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '認証が必要です。' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id, 10);
    const stats = await getReferralStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API] Error fetching referral stats:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}

