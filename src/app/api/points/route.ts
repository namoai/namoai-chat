export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';

// GET: 現在のポイントと出席状況を取得します。
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    let userPoints = await prisma.points.findUnique({
      where: { user_id: userId },
    });

    // ポイント情報が存在しない場合は作成します。
    if (!userPoints) {
      userPoints = await prisma.points.create({
        data: { user_id: userId }
      });
    }

    // 本日出席したか確認します。
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 日付のみを比較するため、時間を初期化します。

    const attendedToday = userPoints.lastAttendedAt ? 
      new Date(userPoints.lastAttendedAt).setHours(0, 0, 0, 0) === today.getTime() : 
      false;

    return NextResponse.json({ ...userPoints, attendedToday });
  } catch (error) {
    console.error("ポイント情報の取得エラー:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}

// POST: ポイントのチャージまたは出席チェックを処理します。
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const parseResult = await safeJsonParse<{ action: string; amount?: number }>(request);
  if (!parseResult.success) return parseResult.error;
  const { action, amount } = parseResult.data;

  try {
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

      const updatedPoints = await prisma.points.update({
        where: { user_id: userId },
        data: {
          free_points: { increment: 30 },
          lastAttendedAt: new Date(),
        },
      });
      return NextResponse.json({ message: '出席チェック完了！30ポイント獲得しました。', points: updatedPoints });
    }

    // ポイントチャージの処理（実際の決済ロジックはありません）
    if (action === 'charge' && amount) {
       const updatedPoints = await prisma.points.update({
        where: { user_id: userId },
        data: {
          paid_points: { increment: amount },
        },
      });
      return NextResponse.json({ message: `${amount}ポイントがチャージされました。`, points: updatedPoints });
    }

    return NextResponse.json({ error: '無効なリクエストです。' }, { status: 400 });

  } catch (error) {
    console.error("ポイント処理エラー:", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
