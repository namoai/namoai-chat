export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

export async function GET() {
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

  try {
    // 1. いま話題のキャラクター
    const trendingCharacters = await prisma.characters.findMany({
      where: { ...safetyWhereClause, ...blockWhereClause }, // フィルターを適用
      orderBy: [
        { interactions: { _count: 'desc' } },
        { favorites: { _count: 'desc' } }
      ],
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      },
    });

    // 2. ホットな新作TOP10
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newTopCharacters = await prisma.characters.findMany({
      where: {
        ...safetyWhereClause,
        ...blockWhereClause, // フィルターを適用
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: {
        interactions: {
          _count: 'desc',
        },
      },
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      },
    });
    
    // 3. 注目のキャラクター（ランダム）
    const filteredCharacterIds = await prisma.characters.findMany({
        where: { ...safetyWhereClause, ...blockWhereClause }, // フィルターを適用
        select: { id: true }
    });
    const shuffled = filteredCharacterIds.sort(() => 0.5 - Math.random());
    const randomIds = shuffled.slice(0, 10).map(c => c.id);

    const specialCharacters = await prisma.characters.findMany({
        where: { id: { in: randomIds } }, // IDリストでの検索なのでブロックフィルターは不要
        include: {
            characterImages: { where: { isMain: true }, take: 1 },
        }
    });

    // 4. 新規キャラクター紹介
    const generalCharacters = await prisma.characters.findMany({
      where: { ...safetyWhereClause, ...blockWhereClause }, // フィルターを適用
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      }
    });

    return NextResponse.json({
      trendingCharacters,
      newTopCharacters,
      specialCharacters,
      generalCharacters,
    });

  } catch (error) {
    console.error("メインページデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}