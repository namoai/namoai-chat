// src/app/api/profile/[userId]/following/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * RouteContext（自前定義）
 * - Next.js のルートハンドラ第二引数には公式型が無いため、
 *   必要最小限の型だけ宣言して関数内で as キャストする。
 */
type RouteContext = {
  params: {
    userId: string;
  };
};

/**
 * フォロー中一覧取得
 * - 対象: params.userId がフォローしているユーザー一覧
 * - 注意: 第二引数に具体的な型注釈を付けない（unknown で受けて as で最小限に絞る）
 */
export async function GET(_req: NextRequest, context: unknown) {
  const { userId } = (context as RouteContext).params;

  const targetUserId = Number(userId);
  if (!Number.isInteger(targetUserId)) {
    return NextResponse.json({ error: 'userId が不正です。' }, { status: 400 });
  }

  try {
    // 「対象がフォローしている人」= where: { followerId: targetUserId }
    const items = await prisma.follows.findMany({
      where: { followerId: targetUserId },
      include: {
        // フォロー先ユーザー情報を最小限で返す（必要に応じて項目を増減）
        following: {
          select: {
            id: true,
            // name: true,
            // username: true,
            // image: true,
          },
        },
      },
      orderBy: { /* createdAt: 'desc' */ followingId: 'asc' }, // createdAt が無い場合に備えた安全策
    });

    const following = items.map((r) => r.following);

    const count = await prisma.follows.count({
      where: { followerId: targetUserId },
    });

    return NextResponse.json({
      userId: targetUserId,
      count,
      following,
    });
  } catch (e) {
    console.error('フォロー中一覧取得エラー:', e);
    return NextResponse.json(
      { error: '処理中にエラーが発生しました。' },
      { status: 500 },
    );
  }
}