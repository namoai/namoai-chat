import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
    }

    const followers = await prisma.follows.findMany({
      where: { followingId: userId },
      select: {
        follower: {
          select: {
            id: true,
            nickname: true,
            image_url: true,
          }
        }
      }
    });

    return NextResponse.json(followers.map(f => f.follower));
  } catch (error) {
    console.error('フォロワーリストの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
