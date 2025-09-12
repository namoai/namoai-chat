import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: '無効なユーザーIDです。' }, { status: 400 });
    }

    const following = await prisma.follows.findMany({
      where: { followerId: userId },
      select: {
        following: {
          select: {
            id: true,
            nickname: true,
            image_url: true,
          }
        }
      }
    });

    return NextResponse.json(following.map(f => f.following));
  } catch (error) {
    console.error('フォロー中リストの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
