export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  try {
    // クエリパラメータがある場合はキャラクターを検索します。
    if (query) {
      const searchResults = await prisma.characters.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { hashtags: { has: query } },
          ],
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
    
    // クエリパラメータがない場合は人気検索語を返します。
    // (interactionsテーブルを活用して人気キャラクターの名前を取得します)
    else {
      const popularCharacters = await prisma.characters.findMany({
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
