export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');
  const sort = searchParams.get('sort') || 'newest'; // デフォルトは「最新順」

  let orderBy = {};
  switch (sort) {
    case 'popular': // 人気順（チャット数）
      orderBy = { interactions: { _count: 'desc' } };
      break;
    case 'likes': // いいね数順
      orderBy = { favorites: { _count: 'desc' } };
      break;
    case 'newest': // 最新順
    default:
      orderBy = { createdAt: 'desc' };
      break;
  }

  const whereClause: any = {
    // ここにsafetyFilterのような共通の条件を追加できます。
  };

  if (tag && tag !== '全体') {
    whereClause.hashtags = {
      has: tag,
    };
  }

  try {
    const characters = await prisma.characters.findMany({
      where: whereClause,
      orderBy: orderBy,
      include: {
        characterImages: { where: { isMain: true }, take: 1 },
        _count: {
          select: { favorites: true, interactions: true }
        }
      },
      take: 50, // ページネーションのために件数制限
    });

    // すべてのハッシュタグリストも一緒に返します。
    const allTags = await prisma.characters.findMany({
      select: {
        hashtags: true,
      },
    });
    
    // 重複を削除し、ユニークなハッシュタグリストを作成します。
    const uniqueTags = [...new Set(allTags.flatMap(c => c.hashtags))];

    return NextResponse.json({ characters, tags: ['全体', ...uniqueTags] });

  } catch (error) {
    console.error("キャラクター一覧APIエラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
