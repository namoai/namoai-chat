export const runtime = 'nodejs';

import { NextResponse, NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth";
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証されていません。" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    // ▼▼▼【追加】セーフティフィルターとブロック機能のロジック ▼▼▼
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true },
    });
    const userSafetyFilter = user?.safetyFilter ?? true; // デフォルトはtrue（フィルターON）

    let blockedAuthorIds: number[] = [];
    const blocks = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockingId: true }
    });
    blockedAuthorIds = blocks.map(b => b.blockingId);
    // ▲▲▲【追加】ロジックここまで ▲▲▲

    const chats = await prisma.chat.findMany({
      where: { 
        userId,
        // ▼▼▼【追加】チャット相手のキャラクターがブロックした作者のものでないことを確認 ▼▼▼
        characters: {
          AND: [
            {
              author_id: {
                notIn: blockedAuthorIds
              }
            },
            // ユーザーのセーフティフィルターがONの場合、キャラクターのセーフティフィルターがOFF（false）のものを除外
            userSafetyFilter ? {
              safetyFilter: { not: false } // nullも許可（未設定）
            } : {}
          ]
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        characters: {
          include: {
            characterImages: {
              take: 1,
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        chat_message: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return NextResponse.json(chats);
  } catch (error) {
    console.error("チャットリストの取得エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました。" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証されていません。" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    const { chatIds } = await request.json();

    if (!Array.isArray(chatIds) || chatIds.length === 0 || !chatIds.every(id => typeof id === 'number')) {
      return NextResponse.json({ error: "無効なチャットIDリストです。" }, { status: 400 });
    }

    const deleteResult = await prisma.chat.deleteMany({
      where: {
        id: { in: chatIds },
        userId: userId,
      },
    });
    
    if (deleteResult.count === 0) {
        return NextResponse.json({ error: "チャットが見つからないか、削除権限がありません。" }, { status: 404 });
    }

    return NextResponse.json({ message: `${deleteResult.count}件のチャットが正常に削除されました。` }, { status: 200 });

  } catch (error) {
    console.error("チャット削除エラー:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました。" }, { status: 500 });
  }
}