export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";

export async function POST(request: NextRequest) {
  // ✅ RequestをNextRequestに修正
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です。" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const { characterId, chatId, forceCreate } = await request.json();

  if (!characterId) {
    return NextResponse.json(
      { error: "キャラクターIDが必要です。" },
      { status: 400 }
    );
  }
  const numericCharacterId = parseInt(characterId, 10);

  try {
    if (chatId) {
      const specificChat = await prisma.chat.findUnique({
        where: {
          id: parseInt(chatId, 10),
          userId: userId, // 他のユーザーのチャットルームを読み込めないようにセキュリティチェック
        },
        include: {
          chat_message: { orderBy: { createdAt: "asc" } },
        },
      });
      if (specificChat) {
        return NextResponse.json(specificChat);
      }
    }

    if (forceCreate) {
      const newChat = await prisma.chat.create({
        data: {
          userId,
          characterId: numericCharacterId,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ ...newChat, chat_message: [] });
    }

    const existingChat = await prisma.chat.findFirst({
      where: { userId, characterId: numericCharacterId },
      orderBy: { id: "desc" },
      include: {
        chat_message: { orderBy: { createdAt: "asc" } },
      },
    });

    if (existingChat) {
      return NextResponse.json(existingChat);
    }

    const newChat = await prisma.chat.create({
      data: { userId, characterId: numericCharacterId, updatedAt: new Date() },
    });
    return NextResponse.json({ ...newChat, chat_message: [] });
  } catch (error) {
    console.error("チャットの検索または作成エラー:", error);
    return NextResponse.json(
      { error: "チャットセッションの開始に失敗しました。" },
      { status: 500 }
    );
  }
}
