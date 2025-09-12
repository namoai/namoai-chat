export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

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
             select: { favorites: true, chat: true }
           }
        },
        take: 30,
      });
      return NextResponse.json(searchResults);
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
          interactions: {
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
