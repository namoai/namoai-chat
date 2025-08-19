export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'realtime'; // 'realtime', 'daily', 'weekly', 'monthly'

  let startDate: Date;
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
      startDate = new Date(now.setHours(now.getHours() - 1));
      break;
  }

  try {
    // ▼▼▼ 変更点: interactionsテーブルを直接集計するように修正しました。 ▼▼▼
    const characters = await prisma.characters.findMany({
      // 安全フィルターが必要な場合は、ここにwhere句を追加してください。
      // where: { safetyFilter: true },
      include: {
        characterImages: {
          where: { isMain: true },
          take: 1,
        },
        _count: {
          select: {
            // charactersと直接関連付けられたinteractionsの数を集計します。
            interactions: {
              where: {
                created_at: {
                  gte: startDate,
                },
              },
            },
          },
        },
      },
    });

    // 集計されたinteractionsの数を基準に降順でソートします。
    const rankedCharacters = characters
      .map(char => ({
        ...char,
        // chatCountを_count.interactionsの値に設定します。
        chatCount: char._count.interactions,
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
