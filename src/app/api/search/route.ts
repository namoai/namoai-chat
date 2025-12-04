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
  const query = searchParams.get('query');

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
    // ▲▲▲【追加】共通ロジックここまで ▲▲▲

    if (query) {
      const searchResults = await prisma.characters.findMany({
        where: {
          AND: [ // 複数の条件を組み合わせるためにANDを使用
            {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { hashtags: { has: query } },
              ]
            },
            safetyWhereClause, // セーフティフィルター条件
            {
              author_id: {
                notIn: blockedAuthorIds // ブロックしたユーザーを除外
              }
            },
            {
              visibility: 'public' // 公開キャラクターのみ
            }
          ]
        },
        include: {
          characterImages: { where: { isMain: true }, take: 1 },
           _count: {
             select: { favorites: true }
           }
        },
        take: 30,
      });

      // 各キャラクターの実際のメッセージ数を計算
      const searchResultsWithMessageCount = await Promise.all(
        searchResults.map(async (char) => {
          const messageCount = await prisma.chat_message.count({
            where: {
              chat: { characterId: char.id },
              isActive: true,
            },
          });
          return {
            ...char,
            _count: {
              ...char._count,
              chat: messageCount,
            },
          };
        })
      );

      return NextResponse.json(searchResultsWithMessageCount);
    } 
    
    // クエリがない場合は、フィルターを適用して人気検索語を返します。
    else {
      const popularCharacters = await prisma.characters.findMany({
        where: {
          AND: [
            safetyWhereClause,
            {
              author_id: {
                notIn: blockedAuthorIds
              }
            },
            {
              visibility: 'public'
            }
          ]
        },
        orderBy: {
          favorites: {
            _count: 'desc',
          },
        },
        take: 10,
        select: {
          name: true,
        },
      });
      const popularKeywords = popularCharacters.map(c => c.name);
      return NextResponse.json({ popularKeywords });
    }
  } catch (error) {
    console.error("検索APIエラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
