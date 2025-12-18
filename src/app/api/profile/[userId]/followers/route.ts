import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

type RouteContext = { params: { userId: string; }; };

export async function GET(_req: NextRequest, context: unknown) {
  if (isBuildTime()) return buildTimeResponse();
  
  const { userId } = (context as RouteContext).params;
  const targetUserId = Number(userId);

  if (!Number.isInteger(targetUserId)) {
    return NextResponse.json({ error: 'userId が不正です。' }, { status: 400 });
  }

  try {
    const prisma = await getPrisma();
    const items = await prisma.follows.findMany({
      where: { followingId: targetUserId },
      include: {
        follower: {
          // Prisma field name is `image` (mapped to DB column `image_url`)
          select: { id: true, nickname: true, image: true },
        },
      },
      orderBy: { followerId: 'asc' }, 
    });

    const followers = items.map((item) => ({
      ...item.follower,
      image: item.follower.image ?? null,
      image_url: item.follower.image ?? null,
    }));
    const count = followers.length;

    return NextResponse.json({ userId: targetUserId, count, followers });
  } catch (e) {
    console.error('フォロワー一覧取得エラー:', e);
    return NextResponse.json({ error: '処理中にエラーが発生しました。' }, { status: 500 });
  }
}