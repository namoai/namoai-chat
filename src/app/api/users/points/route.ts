export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

// ✅ 未使用のrequestパラメータを削除し、警告を解消します
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

    // データベースからユーザーのポイント情報を検索
    const userPoints = await prisma.points.findUnique({
      where: {
        user_id: userId,
      },
    });

    // ポイント情報が見つからない場合（例：登録時に作成されなかったケース）は0を返す
    if (!userPoints) {
      return NextResponse.json({ free_points: 0, paid_points: 0 });
    }

    // ポイント情報をJSON形式で返す
    return NextResponse.json(userPoints);

  } catch (error) {
    console.error('ポイントの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
