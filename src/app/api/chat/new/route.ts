import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * 【修正】常に新しいチャットセッションを開始する (POST)
 * - /api/chat/new
 * - Body: { characterId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);

    const body = await request.json();
    const { characterId } = body;

    if (typeof characterId !== 'number') {
      return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
    }

    // ▼▼▼【変更点】▼▼▼
    // 既存のチャットを探すロジックを削除し、常に新しいチャットを強制的に作成する。
    // これにより、「新しいチャットを開始」ボタンがその名の通りに機能するようになります。
    const chat = await prisma.chat.create({
      data: {
        userId,
        characterId,
      },
    });

    return NextResponse.json({ chatId: chat.id });
    
  } catch (error) {
    console.error('/api/chat/new エラー:', error);
    return NextResponse.json({ error: 'チャットセッションの作成に失敗しました。' }, { status: 500 });
  }
}