export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'realtime'; // 'realtime', 'daily', 'weekly', 'monthly'

  let startDate: Date | undefined = undefined;
  const now = new Date();

  // ランキングの集計期間を設定します。
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
    case 'realtime':
    default:
      // リアルタイムは期間を定めず、全体のチャット数で集計するためstartDateは設定しない
      startDate = undefined;
      break;
  }

  try {
    // ▼▼▼【ここから修正】chatテーブルを集計するようにクエリを変更 ▼▼▼
    const characters = await prisma.characters.findMany({
      where: {
        // 公開されているキャラクターのみを対象
        visibility: 'public',
      },
      include: {
        characterImages: {
          where: { isMain: true },
          take: 1,
        },
        _count: {
          select: {
            // charactersと関連する 'chat' の数を集計
            chat: {
              // startDateが設定されている場合のみ日付でフィルタリング
              where: startDate ? {
                createdAt: {
                  gte: startDate,
                },
              } : undefined,
            },
          },
        },
      },
    });

    // 集計された 'chat' の数を基準に降順でソートします。
    const rankedCharacters = characters
      .map(char => ({
        id: char.id,
        name: char.name,
        description: char.description,
        characterImages: char.characterImages,
        // chatCountを_count.chatの値に設定します。
        chatCount: char._count.chat, 
      }))
      .sort((a, b) => b.chatCount - a.chatCount)
      .slice(0, 50); // 上位50件のみを返します。

    return NextResponse.json(rankedCharacters);

  } catch (error) {
    console.error("ランキングデータの取得エラー:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}
