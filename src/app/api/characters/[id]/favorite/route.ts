import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: { userId: string; }; };

export async function GET(_req: NextRequest, context: unknown) {
  const { userId } = (context as RouteContext).params;
  const targetUserId = Number(userId);

  if (!Number.isInteger(targetUserId)) {
    return NextResponse.json({ error: 'userId が不正です。' }, { status: 400 });
  }

  try {
    const items = await prisma.follows.findMany({
      where: { followerId: targetUserId },
      include: {
        following: {
          select: { id: true, nickname: true, image_url: true },
        },
      },
      orderBy: { followingId: 'asc' },
    });

    const following = items.map((item) => item.following);
    const count = following.length;

    return NextResponse.json({ userId: targetUserId, count, following });
  } catch (e) {
    console.error('フォロー中一覧取得エラー:', e);
    return NextResponse.json({ error: '処理中にエラーが発生しました。' }, { status: 500 });
  }
}