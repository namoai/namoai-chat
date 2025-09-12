export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'realtime';
  let startDate: Date | undefined = undefined;
  const now = new Date();

  switch (period) {
    case 'daily':
      startDate = new Date(now.setDate(now.getDate() - 1));
      break;
    case 'weekly':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'monthly':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      startDate = undefined;
      break;
  }

  try {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    
    // ▼▼▼【追加】セーフティフィルターとブロック機能の共通ロジック ▼▼▼
    let userSafetyFilter = true;
    if (currentUserId) {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId },
        select: { safetyFilter: true }
      });
      if (user && user.safetyFilter !== null) {
        userSafetyFilter = user.safetyFilter;
      }
    }
    const safetyWhereClause = userSafetyFilter ? { safetyFilter: true } : {};

    let blockedAuthorIds: number[] = [];
    if (currentUserId) {
        const blocks = await prisma.block.findMany({
            where: { blockerId: currentUserId },
            select: { blockingId: true }
        });
        blockedAuthorIds = blocks.map(b => b.blockingId);
    }
    const blockWhereClause = { author_id: { notIn: blockedAuthorIds } };
    // ▲▲▲【追加】共通ロジックここまで ▲▲▲

    const characters = await prisma.characters.findMany({
      where: {
        visibility: 'public',
        ...safetyWhereClause, // セーフティフィルター条件を追加
        ...blockWhereClause,   // ブロックしたユーザーを除外
      },
      include: {
        characterImages: {
          where: { isMain: true },
          take: 1,
        },
        _count: {
          select: {
            chat: {
              where: startDate ? { createdAt: { gte: startDate } } : undefined,
            },
          },
        },
      },
    });

    const rankedCharacters = characters
      .map(char => ({
        id: char.id,
        name: char.name,
        description: char.description,
        characterImages: char.characterImages,
        chatCount: char._count.chat, 
      }))
      .sort((a, b) => b.chatCount - a.chatCount)
      .slice(0, 50);

    return NextResponse.json(rankedCharacters);

  } catch (error) {
    console.error("ランキングデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}