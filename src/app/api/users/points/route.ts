export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPointBalance } from '@/lib/point-manager';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// ✅ point_transactionsテーブルから正確な残高を計算して返す
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  // サーバーサイドでセッション情報を取得
  const session = await getServerSession(authOptions);

  // セッションがない、またはユーザーIDがない場合はエラー
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    // セッションから取得したユーザーIDを数値に変換
    const userId = parseInt(session.user.id, 10);

    // point_transactionsテーブルから正確な残高を計算
    const balance = await getPointBalance(userId);

    // ポイント情報をJSON形式で返す（既存のAPI形式に合わせる）
    return NextResponse.json({
      free_points: balance.totalFreePoints,
      paid_points: balance.totalPaidPoints,
    });

  } catch (error) {
    console.error('ポイントの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
