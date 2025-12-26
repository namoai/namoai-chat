export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';
import { getUserSafetyContext } from '@/lib/age';

// GET: 現在のポイントと出席状況を取得します。
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  await ensureEnvVarsLoaded();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    let userPoints = await prisma.points.findUnique({
      where: { user_id: userId },
    });

    // ポイント情報が存在しない場合は作成します。
    if (!userPoints) {
      userPoints = await prisma.points.create({
        data: { user_id: userId }
      });
    }

    // point_transactionsテーブルから正確な残高を計算
    const { getPointBalance } = await import('@/lib/point-manager');
    const balance = await getPointBalance(userId);

    // 本日出席したか確認します。
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 日付のみを比較するため、時間を初期化します。

    const attendedToday = userPoints.lastAttendedAt ? 
      new Date(userPoints.lastAttendedAt).setHours(0, 0, 0, 0) === today.getTime() : 
      false;

    const { ageStatus } = await getUserSafetyContext(prisma, userId);

    // point_transactionsから計算した正確な残高を返す
    return NextResponse.json({ 
      free_points: balance.totalFreePoints,
      paid_points: balance.totalPaidPoints,
      lastAttendedAt: userPoints.lastAttendedAt,
      attendedToday, 
      isMinor: ageStatus.isMinor 
    });
  } catch (error) {
    console.error("ポイント情報の取得エラー:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// POST: ポイントのチャージまたは出席チェックを処理します。
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  await ensureEnvVarsLoaded();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const parseResult = await safeJsonParse<{ action: string; amount?: number }>(request);
  if (!parseResult.success) return parseResult.error;
  const { action, amount } = parseResult.data;

  try {
    const prisma = await getPrisma();
    // 出席チェックの処理
    if (action === 'attend') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const userPoints = await prisma.points.findUnique({
        where: { user_id: userId },
      });

      const lastAttended = userPoints?.lastAttendedAt ? 
        new Date(userPoints.lastAttendedAt).setHours(0, 0, 0, 0) : 
        null;

      if (lastAttended === today.getTime()) {
        return NextResponse.json({ message: '本日は既に出席済みです。' }, { status: 400 });
      }

      // ポイント管理システムを使用してポイント付与
      const { grantPoints } = await import('@/lib/point-manager');
      
      await grantPoints({
        userId,
        amount: 30,
        type: 'free',
        source: 'attendance',
        description: '出席チェック',
      });

      // 更新後のポイント情報を取得
      const updatedPoints = await prisma.points.findUnique({
        where: { user_id: userId },
      });

      return NextResponse.json({ message: '出席チェック完了！30ポイント獲得しました。', points: updatedPoints });
    }

    // ポイントチャージの処理（実際の決済ロジックはありません）
    // ⚠️ 이 액션은 사용되지 않을 수 있지만, 사용되는 경우를 위해 grantPoints 사용
    if (action === 'charge' && amount) {
      const { grantPoints } = await import('@/lib/point-manager');
      await grantPoints({
        userId,
        amount,
        type: 'paid',
        source: 'admin_grant',
        description: 'ポイントチャージ',
      });
      
      // 更新後のポイント情報を取得
      const { getPointBalance } = await import('@/lib/point-manager');
      const balance = await getPointBalance(userId);
      
      return NextResponse.json({ 
        message: `${amount}ポイントがチャージされました。`,
        free_points: balance.totalFreePoints,
        paid_points: balance.totalPaidPoints,
      });
    }

    return NextResponse.json({ error: '無効なリクエストです。' }, { status: 400 });

  } catch (error) {
    console.error("ポイント処理エラー:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
