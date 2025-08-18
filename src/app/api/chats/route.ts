export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  // セッションからユーザーIDを取得
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    // ユーザーのすべてのチャットルームを照会
    const chats = await prisma.chat.findMany({
      where: {
        userId: userId,
      },
      // 最近対話した順にソート
      orderBy: {
        updatedAt: "desc",
      },
      // リスト表示に必要な情報を一緒に取得
      include: {
        // チャット相手のキャラクター情報
        characters: {
          include: {
            characterImages: {
              where: { isMain: true },
              take: 1,
            },
          },
        },
        // 最後のメッセージ1件
        chat_message: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error("チャットリストの取得エラー:", error);
    return NextResponse.json(
      { error: "リストの取得に失敗しました。" },
      { status: 500 }
    );
  }
}