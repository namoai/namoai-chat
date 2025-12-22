export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getPrisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }
  
  const userId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    
    const [totalMessages, totalFavorites, totalCharacters] = await Promise.all([
      // 総チャット数（ユーザーが送受信したメッセージ数）
      prisma.chat_message.count({
        where: {
          chat: { userId },
          isActive: true
        }
      }),
      
      // お気に入り数
      prisma.favorites.count({
        where: { user_id: userId }
      }),
      
      // 作成キャラクター数
      prisma.characters.count({
        where: { author_id: userId }
      })
    ]);
    
    return NextResponse.json({
      totalMessages,
      totalFavorites,
      totalCharacters,
    });
  } catch (error) {
    console.error("ユーザー統計取得エラー:", error);
    return NextResponse.json(
      { error: "統計データの取得に失敗しました。" },
      { status: 500 }
    );
  }
}

