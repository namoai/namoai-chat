export const runtime = 'nodejs';
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
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
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? parseInt(session.user.id, 10) : null;
    
    // ▼▼▼【追加】セーフティフィルターとブロック機能の共通ロジック ▼▼▼
    // nullの場合はtrue（フィルターON）として処理（デフォルト動作）
    let userSafetyFilter = true;
    if (currentUserId) {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId },
        select: { safetyFilter: true }
      });
      userSafetyFilter = user?.safetyFilter ?? true;
    }
    const safetyWhereClause = userSafetyFilter ? { safetyFilter: { not: false } } : {}; // nullも許可（未設定）

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
            favorites: true,
          },
        },
      },
    });

    // 各キャラクターの実際のメッセージ数を計算
    const rankedCharacters = await Promise.all(
      characters.map(async (char) => {
        const messageCount = await prisma.chat_message.count({
          where: {
            chat: { characterId: char.id },
            isActive: true,
            ...(startDate ? { createdAt: { gte: startDate } } : {}),
          },
        });
        return {
          id: char.id,
          name: char.name,
          description: char.description,
          characterImages: char.characterImages,
          chatCount: messageCount,
        };
      })
    );

    const sortedCharacters = rankedCharacters
      .sort((a, b) => b.chatCount - a.chatCount)
      .slice(0, 50);

    return NextResponse.json(sortedCharacters);

  } catch (error) {
    console.error("ランキングデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}