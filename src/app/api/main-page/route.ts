export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

export async function GET() {
  const session = await getServerSession(authOptions);
  let userSafetyFilter = true; 

  if (session?.user?.id) {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(session.user.id, 10) },
      select: { safetyFilter: true }
    });
    if (user && user.safetyFilter !== null) {
      userSafetyFilter = user.safetyFilter;
    }
  }

  const safetyWhereClause = userSafetyFilter ? { safetyFilter: true } : {};

  try {
    // 1. いま話題のキャラクター
    const trendingCharacters = await prisma.characters.findMany({
      where: safetyWhereClause,
      orderBy: [
        { interactions: { _count: 'desc' } },
        { favorites: { _count: 'desc' } }
      ],
      take: 10,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
      },
    });

    // ▼▼▼ 変更点: 「ホットな新作TOP10」のロジックを修正 ▼▼▼
    // 作成後1週間以内のキャラクターをチャット数順で取得します。
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newTopCharacters = await prisma.characters.findMany({
      where: {
        ...safetyWhereClause,
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
        where: safetyWhereClause,
        select: { id: true }
    });
    const shuffled = filteredCharacterIds.sort(() => 0.5 - Math.random());
    const randomIds = shuffled.slice(0, 10).map(c => c.id);

    const specialCharacters = await prisma.characters.findMany({
        where: { id: { in: randomIds } },
        include: {
            characterImages: { where: { isMain: true }, take: 1 },
        }
    });

    // 4. 新規キャラクター紹介
    const generalCharacters = await prisma.characters.findMany({
      where: safetyWhereClause,
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
